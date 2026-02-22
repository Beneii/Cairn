import { getProjectRoot } from "../packages/shared/src/utils.js";
import * as path from "path";
import * as fs from "fs";

console.log("Project Root:", getProjectRoot());
const envPath = path.join(getProjectRoot(), ".env");
console.log("Env Path:", envPath);
console.log("Env Exists:", fs.existsSync(envPath));
if (fs.existsSync(envPath)) {
    console.log("Env Content Length:", fs.readFileSync(envPath, "utf-8").length);
}
