// RAK-TRI-V1 Main Application Entry Point
const { RAKLogger, SecuritySystem, DatabaseManager } = require('./src/core');
const { RAKClient } = require('./src/client');
const { AutoHealer, UpdateEngine } = require('./src/services');
const config = require('./config');

class RAKTRIv1 {
    constructor() {
        this.version = config.version;
        this.logger = new RAKLogger();
        this.security = new SecuritySystem();
        this.db = new DatabaseManager();
        this.healer = new AutoHealer();
        this.updater = new UpdateEngine();
        this.client = null;
    }

    async initialize() {
        try {
            // Start security system
            await this.security.initialize();
            
            // Initialize database with encryption
            await this.db.connect();
            
            // Start auto-healing system
            this.healer.start();
            
            // Check for updates
            await this.updater.checkForUpdates();
            
            this.logger.success(`RAK-TRI-V1 ${this.version} initialized successfully`);
            this.logger.info(`Creator: ${config.CREATOR} | Team: ${config.TEAM} | Realm: ${config.REALM}`);
            
            return true;
        } catch (error) {
            this.logger.error('Initialization failed:', error);
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

            // Security check
            await this.security.preLaunchCheck();

            // Create and start client
            this.client = new RAKClient();
            await this.client.initialize();
            
            this.logger.success('RAK-TRI-V1 Bot started successfully');
            this.logger.info('Anti-Ban Protection: ACTIVE | VC Mode: READY | AI System: ONLINE');

            // Start background services
            this.startBackgroundServices();

        } catch (error) {
            this.logger.error('Failed to start bot:', error);
            await this.handleStartupFailure(error);
        }
    }

    startBackgroundServices() {
        // Auto-update service
        setInterval(() => this.updater.checkForUpdates(), 3600000); // Every hour
        
        // Database backup service
        setInterval(() => this.db.backup(), config.DB_BACKUP);
        
        // System health monitor
        setInterval(() => this.monitorSystemHealth(), 300000); // Every 5 minutes
        
        this.logger.info('Background services started');
    }

    async monitorSystemHealth() {
        const health = {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            connections: this.client ? this.client.getConnectionStats() : 0,
            queue: this.client ? this.client.getQueueSize() : 0
        };

        if (health.memory.heapUsed > config.MAX_MEMORY * 0.8) {
            this.logger.warn('High memory usage detected');
            await this.healer.optimizeMemory();
        }
    }

    async handleStartupFailure(error) {
        this.logger.error('Startup failure handled:', error);
        
        // Attempt auto-recovery
        if (await this.healer.attemptRecovery(error)) {
            this.logger.info('Auto-recovery successful, restarting...');
            setTimeout(() => this.startBot(), 5000);
        } else {
            this.logger.error('Auto-recovery failed, shutting down');
            await this.emergencyShutdown();
        }
    }

    async emergencyShutdown() {
        this.logger.warn('EMERGENCY SHUTDOWN INITIATED');
        
        try {
            if (this.client) {
                await this.client.cleanShutdown();
            }
            await this.db.disconnect();
            this.healer.stop();
        } catch (error) {
            this.logger.error('Emergency shutdown error:', error);
        }
        
        process.exit(1);
    }

    async gracefulShutdown() {
        this.logger.info('Graceful shutdown initiated');
        
        try {
            if (this.client) {
                await this.client.goodbyeMessage();
                await this.client.cleanShutdown();
            }
            await this.db.backup();
            await this.db.disconnect();
            this.healer.stop();
            this.logger.success('Shutdown completed successfully');
        } catch (error) {
            this.logger.error('Graceful shutdown error:', error);
        }
        
        process.exit(0);
    }
}

// Process event handlers
process.on('SIGINT', () => app.gracefulShutdown());
process.on('SIGTERM', () => app.gracefulShutdown());
process.on('uncaughtException', (error) => {
    app.logger.error('Uncaught exception:', error);
    app.emergencyShutdown();
});
process.on('unhandledRejection', (reason, promise) => {
    app.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Main application instance
const app = new RAKTRIv1();

// Start the application
(async () => {
    if (await app.initialize()) {
        await app.startBot();
    }
})();

module.exports = app;