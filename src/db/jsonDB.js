// file: jsonDatabase.js
import fs from "fs/promises";
import path from "path";
import { USERS_LOG_DIR } from "../utils/common.js";
import { checkProcessIsRunning } from "../utils/helpers.js";

export const STATUS_DONE = "DONE";

export function createJSONDatabase(filename) {
  const filepath = path.join(USERS_LOG_DIR, filename);
  let data = {};

  // --- Initialize ---
  function init() {
    try {
      const fileContent = fs.readFileSync(filepath, "utf8");
      data = JSON.parse(fileContent);
    } catch {
      data = {};
      save();
    }
  }

  async function save() {
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }

  async function set(key, value) {
    data[key] = value;
    await save();
    return value;
  }
  async function updateDetail(pk, subk, value) {
    data[pk] = { ...data[pk], [subk]: value };
    await save();
    return value;
  }

  async function get(key) {
    return data[key];
  }

  async function remove(key) {
    delete data[key];
    await save();
  }

  async function getAll() {
    return data;
  }

  async function getAllArray() {
    return Object.values(data);
  }
  async function checkUserByEmail(email) {
    const allProfiles = await getAllArray();
    for (const profile of allProfiles) {
      if (
        profile["status"] != STATUS_DONE &&
        (profile["email"] == email || profile["email"] == `${email}@gmail.com`)
      ) {
        if (await checkProcessIsRunning(profile["pid"])) {
          return profile["userId"];
        }
      }
    }
    return -1;
  }

  // Initialize once when created
  init();

  // --- Return API ---
  return {
    set,
    get,
    remove,
    getAll,
    getAllArray,
    save,
    updateDetail,
    checkUserByEmail,
  };
}
