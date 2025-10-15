// file: jsonDatabase.js
import fs from "fs/promises";
import path from "path";
import { USERS_LOG_DIR } from "../utils/common.js";

export async function createJSONDatabase(filename) {
  const filepath = path.join(USERS_LOG_DIR, filename);
  let data = {};

  // --- Initialize ---
  async function init() {
    try {
      const fileContent = await fs.readFile(filepath, "utf8");
      data = JSON.parse(fileContent);
    } catch {
      data = {};
      await save();
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
    console.log("DB[get]", data, key, data[key]);
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

  // Initialize once when created
  await init();

  // --- Return API ---
  return { set, get, remove, getAll, getAllArray, save, updateDetail };
}
