const TemplateService = require('./templateService');

class JobManager {
  constructor() {
    this.templateService = new TemplateService();
    this.currentJob = null;
    this.refreshInterval = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('[JobManager] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[JobManager] Starting job refresh cycle...');
    
    // Initial job fetch
    this.refreshJob();
    
    // Set up periodic refresh (30-60 seconds)
    this.refreshInterval = setInterval(() => {
      this.refreshJob();
    }, 45000); // 45 seconds
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    console.log('[JobManager] Job refresh cycle stopped');
  }

  async refreshJob() {
    try {
      // Check if template has changed
      if (this.templateService.hasTemplateChanged()) {
        console.log('[JobManager] Template changed, fetching new job...');
        await this.templateService.fetchBlockTemplate();
      }
      
      this.currentJob = this.templateService.getCurrentJob();
      
      if (this.currentJob) {
        console.log(`[JobManager] Active job: ${this.currentJob.jobId} for block ${this.currentJob.blockHeight}`);
      }
    } catch (error) {
      console.error('[JobManager] Error refreshing job:', error.message);
      // Don't throw error, keep system running
    }
  }

  getCurrentJob() {
    return this.currentJob;
  }

  getJobInfo() {
    const templateInfo = this.templateService.getTemplateInfo();
    
    return {
      isRunning: this.isRunning,
      currentJob: this.currentJob,
      templateInfo,
      lastRefresh: this.currentJob ? this.currentJob.timestamp : null
    };
  }

  // Force refresh of current job
  async forceRefresh() {
    try {
      console.log('[JobManager] Force refreshing job...');
      await this.templateService.fetchBlockTemplate();
      this.currentJob = this.templateService.getCurrentJob();
      
      if (this.currentJob) {
        console.log(`[JobManager] New job: ${this.currentJob.jobId} for block ${this.currentJob.blockHeight}`);
      }
      
      return this.currentJob;
    } catch (error) {
      console.error('[JobManager] Error force refreshing job:', error.message);
      throw error;
    }
  }
}

module.exports = JobManager;
