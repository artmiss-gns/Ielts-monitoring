# Koyeb Docker Deployment Guide

This guide explains how to deploy the IELTS Appointment Monitor to Koyeb using Docker mode, which is the recommended approach for applications that need persistent data storage.

## Why Docker Mode for Koyeb?

- **Persistent Data**: Your application needs to store configuration, logs, and appointment data
- **Volume Mounts**: Docker-compose bind mounts don't work in Koyeb's buildpack mode
- **Full Control**: Docker mode gives you complete control over the container environment
- **Chrome/Puppeteer**: Better support for headless browser dependencies

## Deployment Steps

### 1. Use the Koyeb-Optimized Dockerfile

Use `Dockerfile.koyeb` instead of the regular `Dockerfile`:

```bash
# Rename the Koyeb-optimized Dockerfile
mv Dockerfile.koyeb Dockerfile
```

### 2. Configure Koyeb Service

In your Koyeb service settings:

**Service Type**: Web service
**Source**: Your GitHub repository (`artmiss-gns/Ielts-monitoring`)
**Branch**: `main`
**Builder**: Select **"Dockerfile"** (not Buildpack)

**Configure Buildpack** (this section will be hidden when using Dockerfile mode):
- Build command: Leave empty
- Run command: Leave empty (Dockerfile handles this)
- Work directory: Leave as `./` (root)

### 3. Environment Variables

Set these environment variables in Koyeb:

#### Required (for Telegram notifications)
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

#### Optional Configuration
```
NODE_ENV=production
MONITOR_CHECK_INTERVAL=300000
MONITOR_CITIES=tehran,mashhad,isfahan,shiraz,tabriz
MONITOR_EXAM_MODELS=academic,general
MONITOR_MONTHS=1,2,3,4,5,6,7,8,9,10,11,12
MONITOR_BASE_URL=https://irsafam.org/ielts/timetable
MONITOR_LOG_LEVEL=info
ENABLE_METRICS=false
```

### 4. Instance Configuration

- **Instance Type**: Free (0.1 vCPU, 512MB RAM, 2000MB Disk) or higher
- **Region**: Choose based on your location
- **Autoscaling**: Can be enabled if needed

## How It Works

### Data Persistence
Instead of bind mounts, the Koyeb-optimized version:

1. **Creates internal directories**: `/app/config`, `/app/logs`, `/app/data`
2. **Copies default config**: Includes your existing config files in the image
3. **Initializes data files**: Creates empty JSON files for data storage
4. **Uses container storage**: Data persists within the container's filesystem

### Configuration Management
- **Environment Variables**: Primary configuration method
- **Default Config**: Fallback configuration built into the image
- **Runtime Config**: Can be modified via environment variables

### Health Checks
- **Port**: Uses Koyeb's assigned PORT environment variable
- **Health Check**: Built-in health check endpoint
- **Monitoring**: Koyeb can monitor service health

## Key Differences from Local Docker-Compose

| Feature | Local Docker-Compose | Koyeb Docker |
|---------|---------------------|--------------|
| **Data Storage** | Bind mounts to host | Internal container storage |
| **Config Files** | Mounted from host | Copied into image + env vars |
| **Logs** | Mounted to host | Internal container storage |
| **Environment** | .env file mounted | Environment variables |
| **Port** | Fixed port mapping | Dynamic PORT assignment |
| **Restart** | unless-stopped | Managed by Koyeb |

## Monitoring and Logs

### Viewing Logs
- **Koyeb Console**: Use the Console tab in Koyeb dashboard
- **Application Logs**: Stored in `/app/logs/` inside container
- **Health Status**: Monitor via Koyeb's health check system

### Data Access
- **Configuration**: Managed via environment variables
- **Appointment Data**: Stored in `/app/data/` inside container
- **Logs**: Available through Koyeb's logging system

## Troubleshooting

### Build Issues
- **Dockerfile not found**: Ensure `Dockerfile.koyeb` is renamed to `Dockerfile`
- **Build fails**: Check that all dependencies are properly installed
- **Chrome issues**: Verify Puppeteer configuration in Dockerfile

### Runtime Issues
- **Service won't start**: Check environment variables are set correctly
- **No notifications**: Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- **Health check fails**: Ensure PORT environment variable is available

### Data Issues
- **Lost data**: Container restarts may lose data (use Koyeb volumes for persistence)
- **Config not loading**: Check environment variables vs config file priority

## Advanced Configuration

### Using Koyeb Volumes (Optional)
For true data persistence across container restarts:

1. **Create Volume**: In Koyeb dashboard, create a volume
2. **Mount Volume**: Configure volume mount in service settings
3. **Update Dockerfile**: Modify to use volume mount point

### Custom Configuration
- **Environment Variables**: Override any config setting
- **Config File**: Modify `src/koyeb-service.ts` for custom defaults
- **Build Args**: Use Docker build arguments for build-time configuration

## Migration from Local Development

1. **Test Locally**: Use `docker build -t ielts-koyeb .` to test the Koyeb Dockerfile
2. **Environment Variables**: Copy your `.env` settings to Koyeb environment variables
3. **Deploy**: Push changes and deploy to Koyeb
4. **Monitor**: Watch logs and health status in Koyeb dashboard

## Support

If you encounter issues:
1. Check Koyeb service logs
2. Verify environment variables
3. Test the Dockerfile locally first
4. Review this deployment guide
5. Check Koyeb documentation for Docker-specific issues
