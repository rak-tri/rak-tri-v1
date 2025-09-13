# RAK-TRI-V1 Nix Configuration for Replit
{ pkgs }:

{
  deps = [
    # Node.js Ecosystem
    pkgs.nodejs-20_x
    pkgs.yarn
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
    
    # Media Processing
    pkgs.ffmpeg
    pkgs.ffmpeg-headless
    pkgs.libwebp
    pkgs.imagemagick
    pkgs.imagemagickBig
    
    # System Utilities
    pkgs.git
    pkgs.curl
    pkgs.wget
    pkgs.gnutar
    pkgs.gzip
    
    # Security & Encryption
    pkgs.openssl
    pkgs.libsodium
    pkgs.secp256k1
    
    # Database & Storage
    pkgs.sqlite
    pkgs.postgresql
    
    # Development Tools
    pkgs.gcc
    pkgs.gnumake
    pkgs.python3
    pkgs.pkg-config
    
    # RAK-TRI Specific Dependencies
    pkgs.libpng
    pkgs.libjpeg
    pkgs.zlib
    pkgs.cairo
    pkgs.pango
  ];

  env = {
    # RAK-TRI Environment Variables
    RAK_TRI_VERSION = "v1.0.0";
    NODE_ENV = "development";
    HOSTING_PLATFORM = "replit";
    
    # Build Flags
    NODE_OPTIONS = "--enable-source-maps";
    YARN_CACHE_FOLDER = "/tmp/yarn-cache";
    
    # Security Flags
    NODE_NO_WARNINGS = "1";
    NODE_DISABLE_COLORS = "1";
  };

  # Post-install script
  postInstall = ''
    # Create necessary directories
    mkdir -p /tmp/sessions
    mkdir -p /tmp/logs
    mkdir -p /tmp/backups
    
    # Set permissions
    chmod 700 /tmp/sessions
    chmod 700 /tmp/backups
    
    # Clean yarn cache
    yarn cache clean
  '';
}