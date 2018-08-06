"use strict";

const {debug, error} = require("./debug");
const {VolaPrivilegeError, VolaError} = require("./error");

const GENERICS = [
  "roomScore",
  "submitChat",
  "submitCommand",
  "pro",
  "room_old",
];
const MAX_UNACKED = 10;

class Handler {
  constructor(room) {
    this.room = room;
    const handlers = Object.getOwnPropertyNames(Object.getPrototypeOf(this)).
      filter(e => e.startsWith("handle_"));
    for (const h of handlers) {
      this[h] = this[h].bind(room);
    }
    const repost = function(type, data) {
      this.handle_generic(type, data, true);
    };
    for (const g of GENERICS) {
      this[`handle_${g}`] = repost.bind(this, g);
    }
  }

  onmessage(data) {
    data = JSON.parse(data);
    if (!data) {
      return;
    }
    if (!Array.isArray(data)) {
      this.handle_initial_connection(data);
      return;
    }
    this.room.last_ack = data.shift();
    for (const d of data) {
      try {
        const [envelope, ack] = d;
        this.room.sack = ack;
        let [type, msg] = envelope;
        if (type === 2) {
          debug("close message received");
          this.room.close().catch(console.error);
          continue;
        }
        if (type !== 0) {
          // Unhandled
        }
        [type, msg] = msg;
        try {
          const h = `handle_${type}`;
          const {[h]: fn = null} = this;
          if (fn) {
            fn.call(this, msg);
          }
          else {
            this.handle_generic(type, msg);
          }
        }
        catch (ex) {
          error("Failed to handle", type, msg, ex);
        }
        if (this.room.sack >= this.room.last_sack + MAX_UNACKED) {
          this.room.sendAck();
        }
      }
      catch (ex) {
        error(d, ex);
      }
    }
  }

  handle_initial_connection(data) {
    this.connected = true;
    this.version = data.version;
    this.ack = data.ack;
    if (this.session) {
      this.call("useSession", this.session);
    }
    else {
      this.session = data.session;
    }
  }

  handle_owner(data) {
    const {owner = false } = data;
    this.owner = owner;
    this.handler.handle_generic("owner", owner, true);
  }

  handle_admin(data) {
    const {admin = false} = data;
    this.admin = admin;
    this.handler.handle_generic("admin", admin, true);
  }

  handle_staff(data) {
    const {staff = false} = data;
    this.staff = staff;
    this.handler.handle_generic("staff", staff, true);
  }

  handle_session(data) {
    this.session = data;
    this.handler.handle_generic("session", data, true);
  }

  handle_login(data) {
    this.loggedin = true;
    this.handler.handle_generic("login", data, true);
  }

  handle_time(data) {
    this.timediff = data - Date.now();
    this.handler.handle_generic("time", data, true);
  }

  handle_subscribed() {
    debug("firing open resolve");
    /**
     * This Room is not ready for shitposting
     * @event Room#open
     */
    this.emit("open");
    /**
     * This Room will now receive messages
     * @event Room#subscribed
     * @type {Error}
     */
    this.emit("subscribed");
  }

  handle_key(key) {
    this.key = key;
  }

  handle_401(data) {
    const ex = new VolaPrivilegeError();
    ex.data = data;
    this.emit("error", ex);
    this.close();
  }

  handle_429(data) {
    const ex = new VolaError("TOO FAST!");
    ex.timeout = data;
    this.emit("error", ex);
    this.close();
  }

  handle_chat_name(data) {
    this.nick = data || this.nick;
  }

  handle_chat(data) {
    /**
     * Somebody said something, but nobody listened
     * @event Room#chat
     * @type {Message}
     */
    this.emit("chat", new this.Message(this, data));
  }

  handle_files(data) {
    const {"set": set = false, files = []} = data;
    for (let file of files) {
      file = new this.File(this, file);
      /**
       * A random file appears
       * @event Room#file
       * @type {File}
       */
      try {
        this.emit("file", file, set);
        this.emit(`file-${file.id}`, file, set);
      }
      catch (ex) {
        error(ex);
      }
      debug(file.id, file.validFor);
    }
    if (set) {
      /**
       * We got a brand new file list of pre-existing files!
       * @event Room#received_files
       */
      this.emit("received_files");
    }
  }

  handle_fileinfo(data) {
    const {id = null} = data;
    if (!id) {
      return;
    }
    const file = this.getFile(id);
    delete data.id;
    if (file) {
      file.setInfos(data);
    }
    this.emit("fileinfo", id, data);
    this.emit(`fileinfo-${id}`, data);
  }

  handle_delete_file(data) {
    /**
     * A random file vanished
     * @event Room#file
     * @type {string}
     */
    this.emit("delete_file", data);
  }

  handle_user_count(data) {
    this.users = data;
    /**
     * User count changed
     * @event Room#users
     * @type {number}
     */
    this.emit("users", this.users);
  }

  handle_config(config) {
    this.setConfig(config);
    for (const key of Object.keys(config)) {
      this.emit("config", key, config[key]);
    }
  }

  handle_changed_config({key, value}) {
    this.config[key] = value;
    this.updateConfig();
    /**
     * Config changed
     * @event Room#config
     * @type {object}
     * @property {string} name
     * @property {*} value
     */
    this.emit("config", {key, value});
  }

  handle_generic(type, data, reposted = false) {
    if (reposted) {
      debug("generic", type, data);
    }
    else {
      console.log("unhandled message", type, data);
    }
    this.emit(type, data);
  }
}

/**
 * Other stuff also generates events, such as "pro", etc.
 * Subscribe to their names (not actually misc)
 * @event Room#misc
 * @type {*}
 */

module.exports = {Handler};
