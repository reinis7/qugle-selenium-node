# Installation Guide

## 1. Ubuntu 24.04 Setup

### 1.1 Initial System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Add super user (if needed)
sudo adduser <username>
sudo usermod -aG sudo <username>
```

### 1.2 Install XRDP and XFCE

```bash
# Install XRDP for remote desktop

sudo apt install xrdp -y

# Install XFCE desktop environment

sudo apt install xfce4 xfce4-goodies -y

# Configure XRDP to use XFCE

echo xfce4-session > ~/.xsession

# Restart XRDP service

sudo systemctl enable xrdp
sudo systemctl restart xrdp

# Open firewall port for RDP (if firewall is enabled)

sudo ufw allow 3389

```

## 2. Code-Server Installation

```bash
# Download and install code-server
curl -fsSL https://code-server.dev/install.sh | sh

# Enable and start code-server service
sudo systemctl enable --now code-server@$USER

# Check status
sudo systemctl status code-server@$USER
```

### Configure Code-Server

```bash
# Edit code-server config
nano ~/.config/code-server/config.yaml

# Typical configuration:
# bind-addr: 0.0.0.0:8080
# auth: password
# password: your_secure_password
# cert: false
```

## 3. Project Setup
### Install Git and Clone Repository

```bash

# Install git
sudo apt install git -y

# Clone your project
git clone <your-repository-url>
cd <project-directory>

```

## 4. Nginx Installation and Configuration
### Install Nginx
```bash
# Install nginx
sudo apt install nginx -y

# Start and enable nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```
### Configure Nginx as Reverse Proxy

```bash
# Create nginx configuration file
sudo nano /etc/nginx/sites-available/your-domain

# Add the following configuration:
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Accept-Encoding gzip;
    }
}

# Enable the site
sudo ln -s /etc/nginx/sites-available/your-domain /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## 5. NVM and Node.js Installation
### Install NVM (Node Version Manager)

```bash
# Download and install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload bash configuration
source ~/.bashrc

# Verify installation
nvm --version
```
### Install Node.js 22
```bash
### Install Node.js 22
# Install Node.js 22
nvm install 22

# Use Node.js 22 as default
nvm use 22
nvm alias default 22

# Verify installation
node --version
npm --version
```

## 6. Project Dependencies Installation
```bash
# Navigate to project directory
cd /path/to/your/project

# Install npm dependencies
npm install

# If you have specific build commands
npm run build

# For development
npm run dev
```
## 7. Firewall Configuration

```bash
# Enable firewall if not already enabled
sudo ufw enable

# Allow necessary ports
sudo ufw allow ssh
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS (if using SSL)
sudo ufw allow 3389  # RDP
sudo ufw allow 8080  # Code-server (if not using nginx proxy)

# Check firewall status
sudo ufw status
```
## 8. Optional: SSL Certificate with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```