import sodium from "libsodium-wrappers";

export async function injectRepoSecret(
  owner,
  repo,
  secretName,
  secretValue,
  githubToken
) {
  await sodium.ready;

  // 1. Get GitHub repo public key
  const keyRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
    {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!keyRes.ok) {
    const err = await keyRes.text();
    throw new Error(`Failed to get public key for ${owner}/${repo}: ${err}`);
  }

  const { key_id, key } = await keyRes.json();

  // 2. Encrypt the secret using libsodium
  const publicKeyBytes = sodium.from_base64(
    key,
    sodium.base64_variants.ORIGINAL
  );
  const secretBytes = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(secretBytes, publicKeyBytes);
  const encryptedValue = sodium.to_base64(
    encryptedBytes,
    sodium.base64_variants.ORIGINAL
  );

  // 3. Upload the encrypted secret to GitHub
  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        encrypted_value: encryptedValue,
        key_id: key_id,
      }),
    }
  );

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`Failed to set secret on ${owner}/${repo}: ${err}`);
  }

  console.log(`✅ Secret "${secretName}" successfully set on ${owner}/${repo}`);
}
