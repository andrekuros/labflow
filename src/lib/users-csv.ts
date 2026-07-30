import { legacyRoleToProfiles, normalizeProfiles } from "@/lib/profile-meta";

export type ParsedCsvUser = {
  line: number;
  name: string;
  email: string;
  password: string;
  profiles: string[];
};

export type ParseUsersCsvResult = {
  rows: ParsedCsvUser[];
  errors: string[];
};

/** Parse one CSV line respecting quoted fields. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseProfilesField(raw: string | undefined, fallbackRole: string): string[] {
  const trimmed = raw?.trim();
  if (trimmed) {
    const parts = trimmed.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    const normalized = normalizeProfiles(parts);
    if (normalized.length > 0) return normalized;
  }
  const role = (fallbackRole || "contributor").trim().toLowerCase();
  return legacyRoleToProfiles(role);
}

export function parseUsersCsv(csv: string): ParseUsersCsvResult {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const errors: string[] = [];
  const rows: ParsedCsvUser[] = [];

  if (lines.length === 0) {
    errors.push("CSV vazio");
    return { rows, errors };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.includes("email") && header.includes("name");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const col = (name: string) => (hasHeader ? header.indexOf(name) : -1);
  const idx = {
    name: hasHeader ? col("name") : 0,
    email: hasHeader ? col("email") : 1,
    password: hasHeader ? col("password") : 2,
    role: hasHeader ? col("role") : 3,
    profiles: hasHeader ? col("profiles") : -1,
  };

  for (const [i, line] of dataLines.entries()) {
    const lineNo = i + (hasHeader ? 2 : 1);
    const cols = parseCsvLine(line);
    const name = cols[idx.name]?.trim();
    const email = cols[idx.email]?.trim().toLowerCase();
    const password = cols[idx.password]?.trim();
    const role = idx.role >= 0 ? cols[idx.role]?.trim() || "contributor" : "contributor";
    const profilesRaw = idx.profiles >= 0 ? cols[idx.profiles] : undefined;

    if (!name || !email || !password) {
      errors.push(`Linha ${lineNo}: name, email e password obrigatorios`);
      continue;
    }

    if (!email.includes("@")) {
      errors.push(`Linha ${lineNo}: email invalido (${email})`);
      continue;
    }

    const profiles = parseProfilesField(profilesRaw, role);
    if (profiles.length === 0) {
      errors.push(`Linha ${lineNo}: nenhum perfil valido (role/profiles)`);
      continue;
    }

    rows.push({ line: lineNo, name, email, password, profiles });
  }

  return { rows, errors };
}
