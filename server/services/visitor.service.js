// server/services/visitor.service.js
'use strict';

const db = require('../db');

class VisitorService {
  // Track a new visitor
  async trackVisitor(visitorData) {
    try {
      const {
        ip,
        userAgent,
        referer,
        page,
        method,
        sessionId,
        userId = null
      } = visitorData;

      const now = new Date().toISOString();
      
      // Insert visitor record
      const result = await db.run(
        `INSERT INTO visitors (
          ip, user_agent, referer, page, method, session_id, user_id, 
          visited_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ip || null,
          userAgent ? userAgent.substring(0, 500) : null,
          referer || null,
          page || null,
          method || 'GET',
          sessionId || null,
          userId || null,
          now,
          now
        ]
      );

      // Update page views count
      await this.updatePageStats(page);

      return { success: true, id: result.lastID };
    } catch (error) {
      console.error('[VisitorService] Error tracking visitor:', error);
      return { success: false, error: error.message };
    }
  }

  // Update page statistics
  async updatePageStats(page) {
    if (!page) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const existing = await db.get(
        'SELECT id FROM page_stats WHERE page = ? AND date = ?',
        [page, today]
      );
      
      if (existing) {
        await db.run(
          'UPDATE page_stats SET views = views + 1 WHERE id = ?',
          [existing.id]
        );
      } else {
        await db.run(
          'INSERT INTO page_stats (page, date, views) VALUES (?, ?, 1)',
          [page, today]
        );
      }
    } catch (error) {
      console.error('[VisitorService] Error updating page stats:', error);
    }
  }

  // Get visitor statistics for admin
  async getVisitorStats(days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString();

      // Total visitors in period
      const totalVisitors = await db.get(
        `SELECT COUNT(DISTINCT ip) as count, COUNT(*) as total_visits 
         FROM visitors WHERE visited_at >= ?`,
        [startDateStr]
      );

      // Visitors by day
      const visitorsByDay = await db.all(
        `SELECT DATE(visited_at) as date, COUNT(*) as count,
         COUNT(DISTINCT ip) as unique_visitors
         FROM visitors 
         WHERE visited_at >= ?
         GROUP BY DATE(visited_at)
         ORDER BY date DESC`,
        [startDateStr]
      );

      // Most visited pages
      const topPages = await db.all(
        `SELECT page, COUNT(*) as views 
         FROM visitors 
         WHERE visited_at >= ? AND page IS NOT NULL
         GROUP BY page 
         ORDER BY views DESC 
         LIMIT 10`,
        [startDateStr]
      );

      // Referrers
      const topReferrers = await db.all(
        `SELECT referer, COUNT(*) as count 
         FROM visitors 
         WHERE visited_at >= ? AND referer IS NOT NULL AND referer != ''
         GROUP BY referer 
         ORDER BY count DESC 
         LIMIT 10`,
        [startDateStr]
      );

      // Browser/OS stats (from user agent)
      const browsers = await this.parseUserAgents(startDateStr);
      
      // Hourly distribution
      const hourlyDistribution = await db.all(
        `SELECT strftime('%H', visited_at) as hour, COUNT(*) as count 
         FROM visitors 
         WHERE visited_at >= ?
         GROUP BY hour 
         ORDER BY hour`,
        [startDateStr]
      );

      // Recent visitors
      const recentVisitors = await db.all(
        `SELECT ip, page, user_agent, referer, visited_at 
         FROM visitors 
         ORDER BY visited_at DESC 
         LIMIT 50`,
        []
      );

      // Real-time visitors (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const realtimeVisitors = await db.all(
        `SELECT COUNT(*) as count, COUNT(DISTINCT ip) as unique_count 
         FROM visitors 
         WHERE visited_at >= ?`,
        [fiveMinutesAgo]
      );

      return {
        success: true,
        data: {
          total_visitors: totalVisitors?.count || 0,
          total_visits: totalVisitors?.total_visits || 0,
          visitors_by_day: visitorsByDay,
          top_pages: topPages,
          top_referrers: topReferrers,
          browsers: browsers,
          hourly_distribution: hourlyDistribution,
          recent_visitors: recentVisitors.map(v => ({
            ...v,
            user_agent: v.user_agent ? v.user_agent.substring(0, 100) : null
          })),
          realtime: {
            active_visitors: realtimeVisitors?.[0]?.unique_count || 0,
            active_sessions: realtimeVisitors?.[0]?.count || 0
          }
        }
      };
    } catch (error) {
      console.error('[VisitorService] Error getting visitor stats:', error);
      return { success: false, error: error.message };
    }
  }

  // Parse user agents for browser/OS stats
  async parseUserAgents(startDateStr) {
    const visitors = await db.all(
      `SELECT user_agent FROM visitors WHERE visited_at >= ? AND user_agent IS NOT NULL`,
      [startDateStr]
    );
    
    const browsers = {
      Chrome: 0,
      Firefox: 0,
      Safari: 0,
      Edge: 0,
      Opera: 0,
      IE: 0,
      Other: 0,
      Mobile: 0,
      Desktop: 0,
      Tablet: 0
    };
    
    visitors.forEach(v => {
      const ua = v.user_agent.toLowerCase();
      
      // Browser detection
      if (ua.includes('chrome') && !ua.includes('edg')) browsers.Chrome++;
      else if (ua.includes('firefox')) browsers.Firefox++;
      else if (ua.includes('safari') && !ua.includes('chrome')) browsers.Safari++;
      else if (ua.includes('edg')) browsers.Edge++;
      else if (ua.includes('opera') || ua.includes('opr')) browsers.Opera++;
      else if (ua.includes('trident') || ua.includes('msie')) browsers.IE++;
      else browsers.Other++;
      
      // Device type detection
      if (ua.includes('mobile')) browsers.Mobile++;
      else if (ua.includes('tablet')) browsers.Tablet++;
      else browsers.Desktop++;
    });
    
    return browsers;
  }

  // Get page view statistics for charts
  async getPageViewStats(days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString();
      
      const stats = await db.all(
        `SELECT page, date, views 
         FROM page_stats 
         WHERE date >= ? 
         ORDER BY date DESC, views DESC`,
        [startDateStr]
      );
      
      return { success: true, data: stats };
    } catch (error) {
      console.error('[VisitorService] Error getting page view stats:', error);
      return { success: false, error: error.message };
    }
  }

  // Get unique visitors count
  async getUniqueVisitorsCount(days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString();
      
      const result = await db.get(
        `SELECT COUNT(DISTINCT ip) as unique_visitors 
         FROM visitors 
         WHERE visited_at >= ?`,
        [startDateStr]
      );
      
      return { success: true, unique_visitors: result?.unique_visitors || 0 };
    } catch (error) {
      console.error('[VisitorService] Error getting unique visitors:', error);
      return { success: false, error: error.message };
    }
  }

  // Clean old visitor data (keep last 90 days)
  async cleanupOldData() {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString();
      
      const result = await db.run(
        'DELETE FROM visitors WHERE visited_at < ?',
        [ninetyDaysAgoStr]
      );
      
      console.log(`[VisitorService] Cleaned up ${result.changes} old visitor records`);
      return { success: true, deleted: result.changes };
    } catch (error) {
      console.error('[VisitorService] Error cleaning up data:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new VisitorService();