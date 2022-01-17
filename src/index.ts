import express from "express";
import fs from "fs";
import bodyParser from "body-parser";

const app = express();
const PORT = 3000;
const FILE_PATH = "dota-prefs.json";

type Users = {
  [key: string]: string[];
};

type UserRole = {
  user: string;
  role: number;
};

let preferenceCache: Users = null;
generateFileOrUpdateCache();

app.use(bodyParser.json());

app.post("/roles", (req, res) => {
  const { users } = req.body;
  const randomUsers = shuffleArray(users);
  const num = randomUsers.length;
  const prefs = { ...preferenceCache };

  const calculatedRoles: UserRole[] = [];

  while (calculatedRoles.length < num) {
    const user = randomUsers.shift();
    if (user == undefined) break;

    const userPrefs = [...(prefs[user] || []), "1", "2", "3", "4", "5"];

    const pref = findBestAvailablePreference(calculatedRoles, userPrefs);
    if (pref == "fill") {
      delete prefs[user][prefs[user].indexOf("fill")];
      randomUsers.push(user);
      continue;
    }

    calculatedRoles.push({ user: user, role: parseInt(pref) });
  }

  res.json(calculatedRoles);
});

app.get("/", (req, res) => {
  res.json(preferenceCache);
});

app.post("/role", (req, res) => {
  const { user, roles } = req.body;
  preferenceCache[user] = roles;
  updateFile();
  res.status(200).send("Role added");
});

app.get("/healthcheck", (req, res) => {
  res.status(200).send("Totally alive");
});

app.get("/role/:user", (req, res) => {
  const roles = preferenceCache[req.params.user];
  res.status(roles ? 200 : 404).json(roles);
});

function findBestAvailablePreference(
  calculatedRoles: UserRole[],
  userPrefs: string[]
) {
  for (const pref of userPrefs.filter((x) => x != undefined)) {
    const numberPref = parseInt(pref);
    if (calculatedRoles.find((x) => x.role == numberPref)) {
      continue;
    }

    return pref;
  }
}

function generateFileOrUpdateCache() {
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, "{}");
  }

  if (preferenceCache == null) {
    updateCache();
  }
}

function updateCache() {
  const raw = fs.readFileSync(FILE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  preferenceCache = parsed;
}

function updateFile() {
  fs.writeFileSync(FILE_PATH, JSON.stringify(preferenceCache));
}

function shuffleArray(arr: string[]) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});
