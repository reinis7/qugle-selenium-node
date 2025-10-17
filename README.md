# Proxy Service for abc.com

## Overview

This project provides a **proxying layer for [gugle.com](https://accounts.google.com)**, designed to run on Linux environments (Ubuntu 20.04+).  
It integrates **Node.js**, **Nginx**, and **Selenium** under a lightweight **XFCE desktop session (VFCX)**, allowing users to automate, monitor, and inspect proxified traffic efficiently.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Logs and Debugging](#logs-and-debugging)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [License](#license)

---

## Prerequisites

To use this project, you should have a basic understanding of:

- **Linux command line (Ubuntu 20.04 or later)**
- **Nginx reverse proxy configuration**
- **Node.js** (v18+ recommended)
- **Selenium WebDriver**
- **Ubuntu XFCE / VFCX** environment for headless automation

## Logs and Debugging
Logs are stored under the logs/ directory.
User activity and authentication information are saved in:

logs/users.json