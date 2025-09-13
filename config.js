// RAK-TRI-V1 Advanced Configuration System
const { existsSync, readFileSync } = require('fs');
const { join } = require('path');
const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');
require('dotenv').config({ path: existsSync(join(__dirname, '.env')) ? '.env' : '.env.example' });

// Encryption utilities for secure configuration
const encrypt = (text, key) => {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key.padEnd(32, '0').slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), content: encrypted, tag: cipher.getAuthTag().toString('hex') };
};

const decrypt = (encryptedData, key) => {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key.padEnd(32, '0').slice(0, 32)),
    Buffer.from(encryptedData.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
  let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Configuration loader with encryption support
class RAKConfig {
  constructor() {
    this.version = require('./package.json').version;
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-insecure-key-change-immediately';
    this.loadConfig();
  }

  loadConfig() {
    // Core Identification
    this.BOT_NAME = process.env.BOT_NAME || 'RAK-TRI-V1';
    this.CREATOR = process.env.CREATOR || 'RAK-TRI';
    this.TEAM = process.env.TEAM || 'Tri Team';
    this.REALM = process.env.REALM || 'RAK Realm';
    
    // Security & Session
    this.SESSION_ID = process.env.SESSION_ID || `rak_tri_session_${Date.now()}`;
    this.ENCRYPTION_KEY = this.encryptionKey;
    this.VPS_MODE = this.toBool(process.env.VPS_MODE || 'false');
    
    // Ownership
    this.BOT_OWNER = process.env.BOT_OWNER || '';
    this.TRI_TEAM = (process.env.TRI_TEAM_MEMBERS || '').split(',').filter(Boolean);
    this.ADMINS = (process.env.ADMIN_LIST || '').split(',').filter(Boolean);
    
    // Bot Behavior
    this.PREFIX = process.env.PREFIX || '/';
    this.BOT_LANGUAGE = process.env.BOT_LANGUAGE || 'en';
    this.ANTI_BAN_MODE = process.env.ANTI_BAN_MODE || 'high';
    this.MAX_RISK_LEVEL = parseInt(process.env.MAX_COMMAND_RISK_LEVEL || '3');
    this.COOLDOWN_TIME = parseInt(process.env.COMMAND_COOLDOWN || '2000');
    
    // Feature Toggles
    this.VC_MODE = this.toBool(process.env.VC_MODE || 'true');
    this.AUTO_SPAM_BLOCKER = this.toBool(process.env.AUTO_SPAM_BLOCKER || 'true');
    this.GHOST_MODE = this.toBool(process.env.GHOST_MODE || 'false');
    this.SELF_HEALING = this.toBool(process.env.SELF_HEALING || 'true');
    this.AUTO_UPDATE = this.toBool(process.env.AUTO_UPDATE || 'true');
    this.AI_RESPONDER = this.toBool(process.env.AI_RESPONDER || 'true');
    
    // AI Services
    this.AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
    this.OPENAI_KEY = this.encryptField(process.env.OPENAI_API_KEY || '');
    this.GEMINI_KEY = this.encryptField(process.env.GEMINI_API_KEY || '');
    
    // Security Systems
    this.FIREWALL = this.toBool(process.env.FIREWALL_ENABLED || 'true');
    this.BLOCK_SPAM = this.toBool(process.env.AUTO_BLOCK_SPAM || 'true');
    this.BLOCK_LINKS = this.toBool(process.env.SUSPICIOUS_LINK_BLOCKING || 'true');
    this.REJECT_CALLS = this.toBool(process.env.AUTO_REJECT_CALLS || 'false');
    
    // Performance
    this.MAX_MEMORY = parseInt(process.env.MAX_MEMORY_USAGE || '512');
    this.RESTART_SCHEDULE = process.env.RESTART_SCHEDULE || '0 0 */24 * * *';
    this.LOG_RETENTION = parseInt(process.env.LOG_RETENTION_DAYS || '7');
    
    // Database
    this.DB_ENCRYPTED = this.toBool(process.env.DB_ENCRYPTION || 'true');
    this.DB_BACKUP = parseInt(process.env.DB_BACKUP_INTERVAL || '3600000');
  }

  toBool(value) {
    return value === 'true' || value === true;
  }

  encryptField(value) {
    if (!value) return '';
    return encrypt(value, this.encryptionKey);
  }

  decryptField(encryptedData) {
    if (!encryptedData) return '';
    return decrypt(encryptedData, this.encryptionKey);
  }

  // Risk assessment for commands
  assessCommandRisk(command, userLevel) {
    const riskLevels = {
      low: 1,
      medium: 2,
      high: 3,
      extreme: 4,
      critical: 5
    };
    
    // Default risk assessment logic
    return riskLevels.medium;
  }

  // Validate configuration
  validate() {
    const errors = [];
    if (!this.BOT_OWNER) errors.push('BOT_OWNER is required');
    if (!this.SESSION_ID) errors.push('SESSION_ID is required');
    if (this.encryptionKey === 'default-insecure-key-change-immediately') {
      errors.push('ENCRYPTION_KEY must be changed from default');
    }
    return errors;
  }
}

// Export singleton instance
module.exports = new RAKConfig();