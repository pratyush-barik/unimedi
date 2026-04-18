type User = { email: string; phone: string };

const globalForUsers = globalThis as unknown as {
  users?: Map<string, User>;
};

export const users =
  globalForUsers.users || new Map<string, User>();

if (!globalForUsers.users) {
  globalForUsers.users = users;
}

export function createUser(user: User) {
  console.log("Creating user:", user);
  users.set(user.email, user);
}

export function getUser(email: string) {
  const user = users.get(email);
  console.log("Getting user:", email, user);
  return user;
}

export function userExists(email: string) {
  const exists = users.has(email);
  console.log("Checking user:", email, exists);
  return exists;
}