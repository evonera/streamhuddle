import { query } from "./_generated/server";

export const getEverything = query(async (ctx) => {
  return await ctx.db.query("creators").collect();
});
