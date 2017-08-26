"use strict";

const {URL} = require("url");
const {VolaError} = require("./error");

const RE_EXTRACTID = /^\/r\/([a-z0-9_-]+)$/i;
const RE_MATCHID = /^[a-z0-9_-]+$/i;

function parseId(id) {
  if (!id) {
    return null;
  }
  try {
    const url = new URL(id);
    if (!url.pathname) {
      throw new VolaError("Not a valid room URL");
    }
    const m = url.pathname.match(RE_EXTRACTID);
    if (!m) {
      throw new VolaError("Not a valid room URL");
    }
    return m[1];
  }
  catch (ex) {
    const m = id.match(RE_EXTRACTID);
    if (m) {
      return m[1];
    }
    if (!RE_MATCHID.test(id)) {
      throw new VolaError("Not a valid room ID");
    }
    return id;
  }
}

const MIN_NICK = 3;
const MAX_NICK = 12;
const RE_NICK = /^[a-zA-Z0-9]+$/;

function verifyNick(nick, config = {}) {
  if (typeof nick !== "string") {
    throw new VolaError("Nicknames have to be string");
  }
  if (nick.length < MIN_NICK) {
    throw new VolaError("Nicknames have to be at least 3 chars long");
  }
  const {chat_max_alias_length = MAX_NICK} = config;
  if (nick.length > chat_max_alias_length) {
    throw new VolaError(`Nicknames have to be at most ${chat_max_alias_length} chars long`);
  }
  if (!RE_NICK.test(nick)) {
    throw new VolaError("Nickname contains invalid characters");
  }
}

module.exports = {
  parseId,
  verifyNick,
};
