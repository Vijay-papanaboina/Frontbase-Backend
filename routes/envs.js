import express from "express";
import { getEnvs } from "../controllers/envs.js";

const router = express.Router();

router.get("/:githubId/:repoName", getEnvs);

export default router;
