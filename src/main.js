// RAK-TRI-V1 Main Bot Core
// Creator: RAK-TRI | Team: Tri Team | Realm: RAK Realm
// License: RAK-TRI-PRIVATE-1.0

const { RAKLogger, SecuritySystem, DatabaseManager } = require('./src/core');
const { RAKClient, MessageHandler } = require('./src/client');
const { 
    AutoHealer, 
    UpdateEngine, 
    VoiceCommandSystem,
    AntiBanSystem,
    PluginManager,
    AIChatSystem
} = require('./src/services');
const config = require('./config');

class RAKTRIv1 {
    constructor() {
        this.version = config.version;
        this.logger = new RAKLogger();
        this.security = new SecuritySystem();
        this.db = new DatabaseManager();
        this.healer = new AutoHealer();
        this.updater = new UpdateEngine();
        this.vcSystem = new VoiceCommandSystem();
        this.antiBan = new AntiBanSystem();
        this.pluginManager = new PluginManager();
        this.aiSystem = new AIChatSystem();
        this.client = null;
        this.messageHandler = null;
        
        this.startTime = Date.now();
        this.commandStats = new Map();
        this.userSessions = new Map();
    }

    async initialize() {
        try {
            this.logger.success(`🚀 Initializing RAK-TRI-V1 ${this.version}`);
            this.logger.info(`👑 Creator: ${config.CREATOR} | 🛡️ Team: ${config.TEAM} | 🌐 Realm: ${config.REALM}`);

            // Initialize security system first
            await this.security.initialize();
            
            // Initialize database with encryption
            await this.db.connect();
            this.logger.success('✅ Database connected successfully');

            // Load plugins
            await this.pluginManager.loadPlugins();
            this.logger.success(`✅ Loaded ${this.pluginManager.getPluginCount()} plugins`);

            // Initialize AI system
            await this.aiSystem.initialize();
            this.logger.success('✅ AI System initialized');

            // Start auto-healing system
            this.healer.start();
            this.logger.success('✅ Auto-healing system started');

            // Check for updates
            await this.updater.checkForUpdates();
            
            this.logger.success('🎯 RAK-TRI-V1 initialized successfully');
            return true;

        } catch (error) {
            this.logger.error('❌ Initialization failed:', error);
            await this.emergencyShutdown();
            return false;
        }
    }

    async startBot() {
        try {
            // Validate configuration
            const configErrors = config.validate();
            if (configErrors.length > 0) {
                throw new Error(`Configuration errors: ${configErrors.join(', ')}`);
            }

            // Security check before launch
            await this.security.preLaunchCheck();

            // Create and start client
            this.client = new RAKClient();
            this.messageHandler = new MessageHandler(this.client);
            
            await this.client.initialize();
            await this.setupEventHandlers();
            
            this.logger.success('🤖 RAK-TRI-V1 Bot started successfully');
            this.logger.info('🛡️ Anti-Ban Protection: ACTIVE | 🎙️ VC Mode: READY | 🧠 AI System: ONLINE');

            // Send startup notification
            await this.sendStartupNotification();

            // Start background services
            this.startBackgroundServices();

        } catch (error) {
            this.logger.error('❌ Failed to start bot:', error);
            await this.handleStartupFailure(error);
        }
    }

    async setupEventHandlers() {
        // Message event handler
        this.client.on('message', async (message) => {
            try {
                await this.handleIncomingMessage(message);
            } catch (error) {
                this.logger.error('Message handling error:', error);
            }
        });

        // Connection events
        this.client.on('connected', () => {
            this.logger.success('📱 Connected to WhatsApp successfully');
        });

        this.client.on('disconnected', (reason) => {
            this.logger.warn(`📴 Disconnected: ${reason}`);
            this.healer.attemptReconnection();
        });

        // Voice command events
        this.client.on('voice_message', async (voiceMsg) => {
            if (config.VC_MODE) {
                await this.vcSystem.processVoiceCommand(voiceMsg);
            }
        });

        // Error events
        this.client.on('error', (error) => {
            this.logger.error('Client error:', error);
            this.healer.handleError(error);
        });
    }

    async handleIncomingMessage(message) {
        // Anti-ban protection check
        const riskLevel = this.antiBan.assessMessageRisk(message);
        if (riskLevel >= config.MAX_RISK_LEVEL) {
            this.logger.warn(`🚨 High risk message blocked from ${message.from}`);
            return;
        }

        // Check if message is a command
        if (this.isCommand(message.body)) {
            await this.handleCommand(message);
        } else if (this.aiSystem.shouldRespond(message)) {
            await this.handleAIResponse(message);
        }

        // Update user session
        this.updateUserSession(message.from, message);
    }

    async handleCommand(message) {
        const command = this.parseCommand(message.body);
        
        // Command risk assessment
        const riskAssessment = this.security.assessCommandRisk(command, message.from);
        if (riskAssessment.riskLevel > config.MAX_RISK_LEVEL) {
            await this.sendRiskWarning(message, riskAssessment);
            return;
        }

        // Check cooldown
        if (this.isOnCooldown(message.from, command)) {
            await this.sendCooldownMessage(message);
            return;
        }

        // Execute command
        try {
            const result = await this.messageHandler.executeCommand(command, message);
            this.updateCommandStats(command, true);
            
        } catch (error) {
            this.logger.error(`Command execution error: ${command}`, error);
            this.updateCommandStats(command, false);
            await this.sendErrorMessage(message, error);
        }
    }

    async handleAIResponse(message) {
        if (!config.AI_RESPONDER) return;

        const response = await this.aiSystem.generateResponse(message);
        if (response) {
            await this.client.sendMessage(message.from, {
                text: response,
                watermark: config.BOT_NAME
            });
        }
    }

    async sendStartupNotification() {
        if (config.BOT_OWNER) {
            const startupMessage = `
🤖 *RAK-TRI-V1 Started Successfully*
⏰ Uptime: ${new Date().toLocaleString()}
🛡️ Security Level: ${config.ANTI_BAN_MODE}
🎙️ VC Mode: ${config.VC_MODE ? 'Enabled' : 'Disabled'}
🧠 AI Responder: ${config.AI_RESPONDER ? 'Active' : 'Inactive'}

*System Status:*
✅ Database Connected
✅ Plugins Loaded
✅ AI Initialized
✅ Security Active

_RAK Realm | Tri Team | Created by RAK-TRI_
            `.trim();

            await this.client.sendMessage(config.BOT_OWNER, { text: startupMessage });
        }
    }

    startBackgroundServices() {
        // Auto-update service
        setInterval(() => this.updater.checkForUpdates(), 3600000);
        
        // Database backup service
        setInterval(() => this.db.backup(), config.DB_BACKUP);
        
        // System health monitor
        setInterval(() => this.monitorSystemHealth(), 300000);
        
        // Session cleanup
        setInterval(() => this.cleanupOldSessions(), 1800000);

        this.logger.info('🔄 Background services started');
    }

    async monitorSystemHealth() {
        const health = {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            commands: this.commandStats.size,
            sessions: this.userSessions.size,
            connections: this.client ? this.client.getConnectionStats() : 0
        };

        this.logger.debug('System Health:', health);

        // Memory optimization if needed
        if (health.memory.heapUsed > config.MAX_MEMORY * 0.8) {
            this.logger.warn('⚠️ High memory usage detected');
            await this.healer.optimizeMemory();
        }
    }

    cleanupOldSessions() {
        const now = Date.now();
        let cleaned = 0;

        for (const [jid, session] of this.userSessions) {
            if (now - session.lastActivity > 3600000) { // 1 hour
                this.userSessions.delete(jid);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.logger.debug(`🧹 Cleaned ${cleaned} old sessions`);
        }
    }

    async handleStartupFailure(error) {
        this.logger.error('Startup failure handled:', error);
        
        // Attempt auto-recovery
        if (await this.healer.attemptRecovery(error)) {
            this.logger.info('🔄 Auto-recovery successful, restarting...');
            setTimeout(() => this.startBot(), 5000);
        } else {
            this.logger.error('❌ Auto-recovery failed, shutting down');
            await this.emergencyShutdown();
        }
    }

    async emergencyShutdown() {
        this.logger.warn('🛑 EMERGENCY SHUTDOWN INITIATED');
        
        try {
            if (this.client) {
                await this.client.cleanShutdown();
            }
            await this.db.disconnect();
            this.healer.stop();
            this.logger.success('✅ Emergency shutdown completed');
        } catch (error) {
            this.logger.error('Emergency shutdown error:', error);
        }
        
        process.exit(1);
    }

    async gracefulShutdown() {
        this.logger.info('🛑 Graceful shutdown initiated');
        
        try {
            // Send goodbye message to owner
            if (this.client && config.BOT_OWNER) {
                await this.client.sendMessage(config.BOT_OWNER, {
                    text: `🤖 *RAK-TRI-V1 Shutting Down*\n⏰ Uptime: ${this.formatUptime()}\n_Goodbye! 👋_`
                });
            }

            if (this.client) {
                await this.client.cleanShutdown();
            }
            await this.db.backup();
            await this.db.disconnect();
            this.healer.stop();
            
            this.logger.success('✅ Shutdown completed successfully');
        } catch (error) {
            this.logger.error('Graceful shutdown error:', error);
        }
        
        process.exit(0);
    }

    // Utility methods
    isCommand(message) {
        return message && message.startsWith(config.PREFIX);
    }

    parseCommand(message) {
        return message.slice(config.PREFIX.length).trim().split(' ')[0].toLowerCase();
    }

    isOnCooldown(jid, command) {
        const userCooldown = this.userSessions.get(jid)?.cooldowns;
        if (!userCooldown) return false;

        const now = Date.now();
        const lastUsed = userCooldown.get(command);
        return lastUsed && (now - lastUsed) < config.COOLDOWN_TIME;
    }

    updateCommandStats(command, success) {
        const stats = this.commandStats.get(command) || { total: 0, success: 0 };
        stats.total++;
        if (success) stats.success++;
        this.commandStats.set(command, stats);
    }

    updateUserSession(jid, message) {
        let session = this.userSessions.get(jid) || {
            messageCount: 0,
            lastActivity: Date.now(),
            cooldowns: new Map()
        };

        session.messageCount++;
        session.lastActivity = Date.now();
        this.userSessions.set(jid, session);
    }

    formatUptime() {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }

    async sendRiskWarning(message, assessment) {
        const warningMsg = `
⚠️ *COMMAND RISK WARNING*
        
Command: ${assessment.command}
Risk Level: ${assessment.riskLevel}/5
Reason: ${assessment.reason}

_This command may cause WhatsApp restrictions. Use with caution._
        `.trim();

        await this.client.sendMessage(message.from, { text: warningMsg });
    }

    async sendCooldownMessage(message) {
        const cooldownMsg = `⏳ Please wait before using this command again.`;
        await this.client.sendMessage(message.from, { text: cooldownMsg });
    }

    async sendErrorMessage(message, error) {
        const errorMsg = `❌ Error executing command: ${error.message}`;
        await this.client.sendMessage(message.from, { text: errorMsg });
    }
}

// Process event handlers
process.on('SIGINT', () => app.gracefulShutdown());
process.on('SIGTERM', () => app.gracefulShutdown());
process.on('uncaughtException', (error) => {
    app.logger.error('💥 Uncaught exception:', error);
    app.emergencyShutdown();
});
process.on('unhandledRejection', (reason, promise) => {
    app.logger.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
});

// Main application instance
const app = new RAKTRIv1();

// Start the application
(async () => {
    if (await app.initialize()) {
        await app.startBot();
    }
})();

module.exports = RAKTRIv1;
