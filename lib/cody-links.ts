// Links into Cody's own web app (for things the API can't do, e.g. creating bots or setting a bot's folders).
// Verify these paths once in your logged-in Cody account; change them here only.
export const CODY_APP = "https://getcody.ai";
export const CODY_LINKS = {
  bots: `${CODY_APP}/bots`,
  createBot: `${CODY_APP}/bots`, // bot builder lives on the Bots page ("Create bot")
  content: `${CODY_APP}/content`, // knowledge base folders ("Content" menu)
};
