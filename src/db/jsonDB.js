// file: jsonDatabase.js
import fsPromise from "fs/promises";
import fs from "fs";
import path from "path";
import { USERS_LOG_DIR } from "../helpers/utils.js";

export const STATUS_DONE = "DONE";
export const STATUS_INIT = "INIT";
export const STATUS_RUNNING = "RUNNING";

export function createJSONDatabase(filename) {
  const filepath = path.join(USERS_LOG_DIR, filename);
  let data = {};

  // --- Initialize ---
  function init() {
    try {
      const fileContent = fs.readFileSync(filepath, "utf8");
      data = JSON.parse(fileContent);
    } catch (e) {
      console.error(`[createJSONDatabase] ${e.message}`)
      data = {};
      save();
    }
  }

  async function save() {
    await fsPromise.writeFile(
      filepath,
      JSON.stringify(
        data,
        (key, value) => {
          if (key == "driver") return undefined;
          return value;
        },
        2
      )
    );
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

  function get(key) {
    return data[key];
  }

  async function remove(key) {
    delete data[key];
    await save();
  }

  function getAll() {
    return data;
  }

  function getAllArray() {
    return Object.values(data);
  }
  function checkUserByEmail(email) {
    const allProfiles = getAllArray();
    for (const profile of allProfiles) {
      if (
        profile["status"] != STATUS_DONE &&
        (profile["email"] == email || profile["email"] == `${email}@gmail.com`)
      ) {
        return profile;
      }
    }
    return null;
  }
  async function checkIsAlreadySignByEmail(email) {
    const allProfiles = getAllArray();
    for (const profile of allProfiles) {
      if (profile["email"] == email && profile["status"] == STATUS_DONE) {
        return true;
      }
    }
    return false;
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
    checkIsAlreadySignByEmail,
  };
}
