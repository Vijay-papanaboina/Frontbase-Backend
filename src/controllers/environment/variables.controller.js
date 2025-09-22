import { envVarRepository } from "../../repositories/envVar.repository.js";
import { asyncHandler } from "../../middlewares/errorHandler.js";

export const getEnvironmentVariables = asyncHandler(async (req, res) => {
  const { repoId } = req.params;

  const envVars = await envVarRepository.findByRepoId(repoId);
  const envs = envVars.reduce((acc, envVar) => {
    acc[envVar.key] = envVar.value;
    return acc;
  }, {});

  res.json(envs);
});

export const addEnvironmentVariable = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { repoId } = req.params;
  const { key, value } = req.body;

  if (!key || key.trim() === "") {
    return res.status(400).json({ message: "Key is required." });
  }

  await envVarRepository.createOrUpdate({
    userId,
    repoId,
    key,
    value,
  });

  res.status(200).json({ message: "Environment variable added/updated." });
});

export const deleteEnvironmentVariable = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { repoId } = req.params;
  const { key } = req.body;

  if (!key || key.trim() === "") {
    return res.status(400).json({ message: "Key is required." });
  }

  const success = await envVarRepository.deleteByRepoIdAndKey(
    repoId,
    key,
    userId
  );

  if (!success) {
    return res.status(404).json({ message: "Environment variable not found." });
  }

  res.status(200).json({ message: "Environment variable deleted." });
});
