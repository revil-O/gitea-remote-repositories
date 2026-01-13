/**
 * Enhanced G2R Dashboard Webview
 * Version: 1.0.4
 * Publisher: revilo - Oliver Schmidt
 * 
 * Advanced dashboard with:
 * - Responsive design (mobile, tablet, desktop)
 * - VS Code theme support (Light/Dark/Custom)
 * - 6 interactive tabs (Overview, Timeline, Issues, PRs, Developers, Commits)
 * - Dynamic color adaptation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  body?: string;
}

export class ChangelogPanel {
  public static currentPanel: ChangelogPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ChangelogPanel.currentPanel) {
      ChangelogPanel.currentPanel._panel.reveal(column);
      ChangelogPanel.currentPanel._update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'changelogPanel',
      'G2R Dashboard',
      column || vscode.ViewColumn.One,
      getWebviewOptions(extensionUri)
    );

    ChangelogPanel.currentPanel = new ChangelogPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'copyCommit':
            vscode.env.clipboard.writeText(message.hash);
            vscode.window.showInformationMessage(
              `Commit ${message.hash.slice(0, 7)} copied!`
            );
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    ChangelogPanel.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  private _getHtmlForWebview(_webview: vscode.Webview): string {
    const changelogData = this._getChangelogData();
    const gitCommits = this._getGitCommits();
    const timeline = this._buildTimeline(gitCommits);
    const developers = this._extractDevelopers(gitCommits);
    const mockIssues = this._getMockIssuesAndPRs();

    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>G2R Dashboard</title>
    <style>
        :root {
            /* VS Code Theme Colors - Light/Dark adaptive */
            --vscode-editor-background: var(--background, #1e1e1e);
            --vscode-editor-foreground: var(--foreground, #d4d4d4);
            --vscode-editor-line-highlightBackground: var(--lineHighlightBackground, #f00000);
            --vscode-editorCursor-foreground: var(--cursorForeground, #aeafad);
            
            /* Custom Variables */
            --color-primary: #00c853;
            --color-secondary: #1de9b6;
            --color-danger: #F44336;
            --color-warning: #FF9800;
            --color-info: #2196F3;
            --color-success: #4CAF50;
            
            --bg-primary: #1a1a1a;
            --bg-secondary: #222222;
            --bg-tertiary: #2a2a2a;
            
            --border-color: #2a2a2a;
            --text-primary: #e0e0e0;
            --text-secondary: #888888;
            --text-tertiary: #666666;
        }

        /* Light Theme Adaptations */
        @media (prefers-color-scheme: light) {
            :root {
                --bg-primary: #f5f5f5;
                --bg-secondary: #ffffff;
                --bg-tertiary: #e8e8e8;
                --border-color: #d0d0d0;
                --text-primary: #333333;
                --text-secondary: #666666;
                --text-tertiary: #999999;
                --color-primary: #00a83a;
            }
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html, body {
            width: 100%;
            height: 100%;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 16px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 20px;
        }

        .header h1 {
            font-size: clamp(1.8em, 5vw, 2.8em);
            background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }

        .header p {
            color: var(--text-secondary);
            font-size: clamp(0.85em, 2vw, 0.95em);
        }

        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            border-bottom: 1px solid var(--border-color);
            overflow-x: auto;
            overflow-y: hidden;
            flex-wrap: wrap;
            padding-bottom: 10px;
            -webkit-overflow-scrolling: touch;
        }

        .tabs::-webkit-scrollbar {
            height: 4px;
        }

        .tabs::-webkit-scrollbar-track {
            background: transparent;
        }

        .tabs::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 2px;
        }

        .tab-button {
            padding: 12px 20px;
            background: transparent;
            color: var(--text-secondary);
            border: none;
            cursor: pointer;
            font-size: clamp(0.85em, 2vw, 0.95em);
            transition: all 0.3s ease;
            border-bottom: 2px solid transparent;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .tab-button:hover {
            color: var(--color-primary);
        }

        .tab-button.active {
            color: var(--color-primary);
            border-bottom-color: var(--color-primary);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { 
                opacity: 0;
                transform: translateY(5px);
            }
            to { 
                opacity: 1;
                transform: translateY(0);
            }
        }

        .grid-2 {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
            gap: 16px;
            margin-bottom: 30px;
        }

        @media (max-width: 768px) {
            .grid-2 {
                grid-template-columns: 1fr;
            }
        }

        .stat-box {
            background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
            padding: 20px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            text-align: center;
            transition: all 0.3s ease;
        }

        .stat-box:hover {
            border-color: var(--color-primary);
            box-shadow: 0 0 12px rgba(0, 200, 83, 0.1);
        }

        .stat-number {
            font-size: clamp(1.8em, 5vw, 2.2em);
            font-weight: bold;
            color: var(--color-primary);
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: clamp(0.8em, 2vw, 0.9em);
            margin-top: 8px;
        }

        .card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 18px;
            transition: all 0.3s ease;
            margin-bottom: 15px;
        }

        .card:hover {
            border-color: var(--color-primary);
            background: var(--bg-tertiary);
            box-shadow: 0 0 15px rgba(0, 200, 83, 0.15);
        }

        .card-title {
            font-weight: 600;
            color: var(--color-primary);
            margin-bottom: 8px;
            font-size: clamp(0.95em, 2vw, 1.05em);
        }

        .card-description {
            color: var(--text-secondary);
            font-size: clamp(0.85em, 2vw, 0.95em);
            margin-bottom: 10px;
        }

        .labels {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin: 10px 0;
        }

        .label {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75em;
            font-weight: 600;
            border: 1px solid;
        }

        .label-enhancement { background: rgba(0, 200, 83, 0.1); border-color: var(--color-primary); color: var(--color-primary); }
        .label-bug { background: rgba(244, 67, 54, 0.1); border-color: var(--color-danger); color: var(--color-danger); }
        .label-documentation { background: rgba(33, 150, 243, 0.1); border-color: var(--color-info); color: var(--color-info); }
        .label-critical { background: rgba(255, 87, 34, 0.1); border-color: var(--color-warning); color: var(--color-warning); }

        .assignees {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 10px 0;
        }

        .assignee {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 10px;
            background: var(--bg-tertiary);
            border-radius: 20px;
            font-size: 0.85em;
            border: 1px solid var(--border-color);
        }

        .meta-info {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            font-size: clamp(0.75em, 2vw, 0.85em);
            color: var(--text-secondary);
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid var(--border-color);
        }

        .meta-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .timeline {
            position: relative;
            padding-left: 40px;
        }

        @media (max-width: 480px) {
            .timeline {
                padding-left: 20px;
            }
        }

        .timeline-item {
            position: relative;
            padding-bottom: 24px;
            border-left: 2px solid var(--border-color);
            padding-left: 20px;
        }

        .timeline-item:last-child {
            border-left-color: transparent;
        }

        .timeline-item::before {
            content: '';
            position: absolute;
            left: -9px;
            top: 0;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--color-primary);
            border: 2px solid var(--bg-primary);
        }

        .timeline-date {
            font-size: clamp(0.7em, 2vw, 0.8em);
            color: var(--text-tertiary);
        }

        .timeline-message {
            color: var(--text-primary);
            margin-top: 4px;
            font-weight: 500;
        }

        .timeline-author {
            color: var(--text-secondary);
            font-size: clamp(0.7em, 2vw, 0.8em);
            margin-top: 4px;
        }

        .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.75em;
            font-weight: 600;
        }

        .status-open { background: rgba(0, 200, 83, 0.1); color: var(--color-primary); }
        .status-closed { background: rgba(244, 67, 54, 0.1); color: var(--color-danger); }
        .status-merged { background: rgba(156, 39, 176, 0.1); color: #9C27B0; }

        .issue-item, .pr-item {
            background: var(--bg-secondary);
            border-left: 4px solid;
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 12px;
            transition: all 0.3s ease;
        }

        .issue-item {
            border-left-color: var(--color-info);
        }

        .issue-item.closed {
            border-left-color: #9C27B0;
            opacity: 0.75;
        }

        .pr-item {
            border-left-color: var(--color-primary);
        }

        .pr-item.merged {
            border-left-color: #9C27B0;
            opacity: 0.75;
        }

        .issue-item:hover, .pr-item:hover {
            background: var(--bg-tertiary);
            box-shadow: 0 0 10px rgba(0, 200, 83, 0.1);
        }

        .issue-header, .pr-header {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        @media (min-width: 480px) {
            .issue-header, .pr-header {
                flex-direction: row;
                justify-content: space-between;
                align-items: flex-start;
            }
        }

        .issue-number, .pr-number {
            font-weight: 600;
            color: var(--color-primary);
            font-size: clamp(0.95em, 2vw, 1.05em);
        }

        .developer-card {
            text-align: center;
            padding: 18px;
            background: var(--bg-secondary);
            border-radius: 8px;
            border: 1px solid var(--border-color);
            transition: all 0.3s ease;
        }

        .developer-card:hover {
            border-color: var(--color-primary);
            box-shadow: 0 0 10px rgba(0, 200, 83, 0.1);
        }

        .developer-avatar {
            font-size: clamp(2em, 5vw, 2.5em);
            margin-bottom: 8px;
        }

        .developer-name {
            font-weight: 600;
            color: var(--text-primary);
            margin: 8px 0 4px;
            font-size: clamp(0.9em, 2vw, 1em);
        }

        .developer-commits {
            color: var(--text-secondary);
            font-size: clamp(0.8em, 2vw, 0.9em);
        }

        .commit-item {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 14px;
            margin-bottom: 10px;
            transition: all 0.3s ease;
        }

        .commit-item:hover {
            border-color: var(--color-primary);
            background: var(--bg-tertiary);
        }

        .commit-hash {
            background: var(--bg-primary);
            padding: 4px 8px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: clamp(0.7em, 2vw, 0.8em);
            color: var(--text-secondary);
            cursor: pointer;
            user-select: all;
            transition: all 0.2s ease;
            display: inline-block;
            word-break: break-all;
        }

        .commit-hash:hover {
            background: var(--color-primary);
            color: var(--bg-primary);
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--border-color);
            text-align: center;
            color: var(--text-tertiary);
            font-size: clamp(0.75em, 2vw, 0.85em);
        }

        .no-data {
            text-align: center;
            padding: 40px 20px;
            color: var(--text-secondary);
            font-size: clamp(0.85em, 2vw, 0.95em);
        }

        /* Responsive Typography */
        @media (max-width: 480px) {
            body {
                padding: 12px;
            }

            .header {
                margin-bottom: 20px;
                padding-bottom: 15px;
            }

            .tabs {
                margin-bottom: 20px;
                gap: 5px;
            }

            .tab-button {
                padding: 10px 16px;
            }

            .grid-2 {
                gap: 12px;
                margin-bottom: 20px;
            }

            .card {
                padding: 14px;
                margin-bottom: 12px;
            }

            .timeline {
                padding-left: 20px;
            }

            .timeline-item {
                padding-left: 15px;
            }

            .issue-item, .pr-item {
                padding: 12px;
                margin-bottom: 10px;
            }

            .footer {
                margin-top: 20px;
                padding-top: 15px;
            }
        }

        /* Tablet & Medium Devices */
        @media (min-width: 481px) and (max-width: 1024px) {
            body {
                padding: 16px;
            }

            .grid-2 {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        /* Large Desktop Screens */
        @media (min-width: 1025px) {
            .grid-2 {
                grid-template-columns: repeat(3, 1fr);
            }

            .container {
                padding: 0 20px;
            }
        }

        /* Accessibility: Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
            * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }

        /* Print Styles */
        @media print {
            body {
                background: white;
                color: black;
            }

            .tab-button {
                display: none;
            }

            .tab-content {
                display: block !important;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 G2R Dashboard</h1>
            <p>Repository Overview, Issues & Pull Requests</p>
        </div>

        <div class="tabs">
            <button class="tab-button active" onclick="switchTab('overview')">📈 Overview</button>
            <button class="tab-button" onclick="switchTab('timeline')">📅 Timeline</button>
            <button class="tab-button" onclick="switchTab('issues')">🐛 Issues</button>
            <button class="tab-button" onclick="switchTab('prs')">🔀 PRs</button>
            <button class="tab-button" onclick="switchTab('developers')">👥 Developers</button>
            <button class="tab-button" onclick="switchTab('commits')">📝 Commits</button>
        </div>

        <!-- Overview Tab -->
        <div id="overview" class="tab-content active">
            ${this._renderOverview(changelogData, gitCommits, mockIssues, developers)}
        </div>

        <!-- Timeline Tab -->
        <div id="timeline" class="tab-content">
            ${this._renderTimeline(timeline)}
        </div>

        <!-- Issues Tab -->
        <div id="issues" class="tab-content">
            ${this._renderIssues(mockIssues)}
        </div>

        <!-- PRs Tab -->
        <div id="prs" class="tab-content">
            ${this._renderPullRequests(mockIssues)}
        </div>

        <!-- Developers Tab -->
        <div id="developers" class="tab-content">
            ${this._renderDevelopers(developers)}
        </div>

        <!-- Commits Tab -->
        <div id="commits" class="tab-content">
            ${this._renderCommits(gitCommits)}
        </div>

        <div class="footer">
            <p>G2R © 2026 revilo - Oliver Schmidt | MIT License</p>
            <p style="margin-top: 10px;">Last updated: ${new Date().toLocaleString('de-DE')}</p>
        </div>
    </div>

    <script>
        // Initialize VS Code Theme Colors
        function initializeTheme() {
            const style = getComputedStyle(document.documentElement);
            const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            
            // Set CSS variables from VS Code theme
            document.documentElement.style.setProperty('--background', getThemeColor('editor.background'));
            document.documentElement.style.setProperty('--foreground', getThemeColor('editor.foreground'));
            document.documentElement.style.setProperty('--cursorForeground', getThemeColor('editorCursor.foreground'));
            
            console.log('Theme initialized: ' + theme);
        }

        function getThemeColor(colorId) {
            const style = getComputedStyle(document.documentElement);
            return style.getPropertyValue('--vscode-' + colorId).trim() || style.getPropertyValue('--' + colorId).trim();
        }

        // Watch for theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            initializeTheme();
        });

        // Initialize on load
        document.addEventListener('DOMContentLoaded', initializeTheme);

        function switchTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(el => {
                el.classList.remove('active');
            });
            document.querySelectorAll('.tab-button').forEach(el => {
                el.classList.remove('active');
            });

            document.getElementById(tabName).classList.add('active');
            event.target.classList.add('active');
            
            // Store active tab in sessionStorage
            sessionStorage.setItem('activeTab', tabName);
        }

        function copyCommit(hash) {
            const vscode = acquireVsCodeApi();
            vscode.postMessage({
                command: 'copyCommit',
                hash: hash
            });
        }

        // Restore active tab on page load
        window.addEventListener('load', function() {
            var activeTab = sessionStorage.getItem('activeTab');
            if (activeTab) {
                var tabButtons = document.querySelectorAll('.tab-button');
                for (var i = 0; i < tabButtons.length; i++) {
                    var btn = tabButtons[i];
                    var onClickAttr = btn.getAttribute('onclick');
                    if (onClickAttr && onClickAttr.includes(activeTab)) {
                        btn.click();
                        break;
                    }
                }
            }
        });
    </script>
</body>
</html>`;
  }

  private _renderOverview(changelogData: any, commits: GitCommit[], issues: any, developers: Map<string, number>): string {
    const openIssues = issues.filter((i: any) => !i.isPR && i.status === 'open').length;
    const openPRs = issues.filter((i: any) => i.isPR && i.status === 'open').length;

    return `
      <div class="grid-2">
        <div class="stat-box">
          <div class="stat-number">${commits.length}</div>
          <div class="stat-label">Total Commits</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${developers.size}</div>
          <div class="stat-label">Active Developers</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${openIssues}</div>
          <div class="stat-label">Open Issues</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${openPRs}</div>
          <div class="stat-label">Open PRs</div>
        </div>
      </div>

      <h2 style="color: var(--color-primary); margin: 30px 0 20px; font-size: clamp(1.1em, 3vw, 1.3em);">📋 Latest Changes</h2>
      ${this._renderChangelogSummary(changelogData)}

      <h2 style="color: var(--color-primary); margin: 30px 0 20px; font-size: clamp(1.1em, 3vw, 1.3em);">🔄 Recent Activity</h2>
      ${this._renderRecentActivity(issues.slice(0, 3))}
    `;
  }

  private _renderChangelogSummary(changelogData: any): string {
    const { sections } = changelogData;
    const cards = [
      { icon: '✨', label: 'Added', items: sections.added, color: '#00c853' },
      { icon: '🔄', label: 'Changed', items: sections.changed, color: '#2196F3' },
      { icon: '🔧', label: 'Fixed', items: sections.fixed, color: '#FF9800' },
      { icon: '🔒', label: 'Security', items: sections.security, color: '#F44336' },
    ];

    return cards
      .filter((card) => card.items.length > 0)
      .map(
        (card) => `
      <div class="card" style="border-top: 3px solid ${card.color};">
        <div class="card-title">${card.icon} ${card.label} (${card.items.length})</div>
        <ul style="list-style: none; margin: 10px 0;">
          ${card.items
            .slice(0, 3)
            .map((item: string) => `<li style="color: var(--text-secondary); margin: 6px 0;">• ${item}</li>`)
            .join('')}
        </ul>
      </div>
    `
      )
      .join('');
  }

  private _renderRecentActivity(issues: any[]): string {
    if (issues.length === 0) {
      return '<div class="no-data">No recent activity</div>';
    }

    return issues
      .map((issue) => {
        const type = issue.isPR ? '🔀 PR' : '🐛 Issue';
        return `
      <div class="card">
        <div class="card-title">${type} #${issue.number}: ${issue.title}</div>
        <div class="card-description">${issue.description || 'No description'}</div>
        <div class="labels">
          ${issue.labels.map((label: any) => `<span class="label label-${label.name.toLowerCase().replace(/\\s/g, '-')}">${label.name}</span>`).join('')}
        </div>
        <div class="assignees">
          ${issue.assignees.map((assignee: any) => `<span class="assignee">👤 ${assignee.name}</span>`).join('')}
        </div>
        <div class="meta-info">
          <div class="meta-item">📅 ${new Date(issue.createdAt).toLocaleDateString('de-DE')}</div>
          <div class="meta-item">✍️ ${issue.author}</div>
          <div class="meta-item"><span class="status-badge status-${issue.status}">${issue.status.toUpperCase()}</span></div>
        </div>
      </div>
    `;
      })
      .join('');
  }

  private _renderTimeline(timeline: any[]): string {
    if (timeline.length === 0) {
      return '<div class="no-data">No events found</div>';
    }

    return `<div class="timeline">
      ${timeline
        .slice(0, 25)
        .map(
          (event) => `
        <div class="timeline-item">
          <div class="timeline-date">${event.timestamp}</div>
          <div class="timeline-message">📝 ${event.message}</div>
          <div class="timeline-author">👤 ${event.author}</div>
        </div>
      `
        )
        .join('')}
    </div>`;
  }

  private _renderIssues(issues: any[]): string {
    const openIssues = issues.filter((i) => !i.isPR);
    if (openIssues.length === 0) {
      return '<div class="no-data">No issues found</div>';
    }

    return openIssues
      .map(
        (issue) => `
      <div class="issue-item ${issue.status}">
        <div class="issue-header">
          <div>
            <div class="issue-number">#${issue.number} ${issue.title}</div>
            <div class="card-description">${issue.description || 'No description'}</div>
          </div>
          <span class="status-badge status-${issue.status}">${issue.status.toUpperCase()}</span>
        </div>
        <div class="labels">
          ${issue.labels.map((label: any) => `<span class="label label-${label.name.toLowerCase().replace(/\\s/g, '-')}">${label.name}</span>`).join('')}
        </div>
        <div class="assignees">
          ${issue.assignees.map((assignee: any) => `<span class="assignee">👤 ${assignee.name}</span>`).join('')}
        </div>
        <div class="meta-info">
          <div class="meta-item">📅 ${new Date(issue.createdAt).toLocaleDateString('de-DE')}</div>
          <div class="meta-item">✍️ ${issue.author}</div>
        </div>
      </div>
    `
      )
      .join('');
  }

  private _renderPullRequests(issues: any[]): string {
    const prs = issues.filter((i) => i.isPR);
    if (prs.length === 0) {
      return '<div class="no-data">No pull requests found</div>';
    }

    return prs
      .map(
        (pr) => `
      <div class="pr-item ${pr.status}">
        <div class="pr-header">
          <div>
            <div class="pr-number">#${pr.number} ${pr.title}</div>
            <div class="card-description">${pr.description || 'No description'}</div>
          </div>
          <span class="status-badge status-${pr.status}">${pr.status.toUpperCase()}</span>
        </div>
        <div class="labels">
          ${pr.labels.map((label: any) => `<span class="label label-${label.name.toLowerCase().replace(/\\s/g, '-')}">${label.name}</span>`).join('')}
        </div>
        <div class="assignees">
          ${pr.assignees.map((assignee: any) => `<span class="assignee">👤 ${assignee.name}</span>`).join('')}
        </div>
        <div class="meta-info">
          <div class="meta-item">📅 ${new Date(pr.createdAt).toLocaleDateString('de-DE')}</div>
          <div class="meta-item">✍️ ${pr.author}</div>
          <div class="meta-item">💾 ${pr.commits || 0} commits</div>
        </div>
      </div>
    `
      )
      .join('');
  }

  private _renderDevelopers(developers: Map<string, number>): string {
    const devArray = Array.from(developers.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    if (devArray.length === 0) {
      return '<div class="no-data">No developers found</div>';
    }

    return `<div class="grid-2">
      ${devArray
        .map(
          ([dev, count]) => `
        <div class="developer-card">
          <div class="developer-avatar">👤</div>
          <div class="developer-name">${dev}</div>
          <div class="developer-commits">${count} commit${count > 1 ? 's' : ''}</div>
        </div>
      `
        )
        .join('')}
    </div>`;
  }

  private _renderCommits(commits: GitCommit[]): string {
    if (commits.length === 0) {
      return '<div class="no-data">No commits found</div>';
    }

    return commits
      .slice(0, 20)
      .map(
        (commit) => `
      <div class="commit-item">
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 10px;">
          <div>
            <div class="card-title">${commit.message}</div>
            <div class="meta-info" style="border: none; padding: 8px 0 0 0; margin-top: 0;">
              <div class="meta-item">📅 ${commit.date}</div>
              <div class="meta-item">✍️ ${commit.author}</div>
            </div>
          </div>
          <span class="commit-hash" onclick="copyCommit('${commit.hash}')" title="Click to copy">
            ${commit.hash.slice(0, 7)}
          </span>
        </div>
        ${commit.body ? `<div style="color: var(--text-secondary); margin-top: 10px; font-size: 0.9em; border-top: 1px solid var(--border-color); padding-top: 10px;">${commit.body.substring(0, 150)}...</div>` : ''}
      </div>
    `
      )
      .join('');
  }

  private _getChangelogData(): any {
    try {
      const changelogPath = path.join(this._extensionUri.fsPath, 'CHANGELOG.md');
      const content = fs.readFileSync(changelogPath, 'utf-8');

      const sections = {
        added: [] as string[],
        changed: [] as string[],
        fixed: [] as string[],
        security: [] as string[],
      };

      const lines = content.split('\n');
      let currentSection = '';

      for (const line of lines) {
        if (line.includes('### Added')) currentSection = 'added';
        else if (line.includes('### Changed')) currentSection = 'changed';
        else if (line.includes('### Fixed')) currentSection = 'fixed';
        else if (line.includes('### Security')) currentSection = 'security';
        else if (line.startsWith('- ') && currentSection) {
          sections[currentSection as keyof typeof sections].push(line.substring(2));
        }
      }

      return { currentVersion: '1.0.3', sections };
    } catch (error) {
      return {
        currentVersion: '1.0.3',
        sections: { added: [], changed: [], fixed: [], security: [] },
      };
    }
  }

  private _getGitCommits(): GitCommit[] {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return [];

      const gitLog = execSync(
        'git log --pretty=format:"%h|%s|%an|%ar|%b" -30',
        { cwd: workspaceFolder.uri.fsPath }
      )
        .toString()
        .split('\n\n');

      return gitLog
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split('|');
          return {
            hash: parts[0] || '',
            message: parts[1] || '',
            author: parts[2] || 'Unknown',
            date: parts[3] || '',
            body: parts[4]?.trim(),
          };
        });
    } catch (error) {
      return [];
    }
  }

  private _buildTimeline(commits: GitCommit[]): any[] {
    return commits.map((commit) => ({
      timestamp: commit.date,
      message: commit.message,
      author: commit.author,
    }));
  }

  private _getMockIssuesAndPRs(): any[] {
    return [
      {
        number: 15,
        title: 'Add improved error handling',
        description: 'Implement better error handling for API calls',
        status: 'open',
        isPR: false,
        labels: [{ name: 'enhancement', color: 'green' }],
        assignees: [{ name: 'Developer 1', login: 'dev1' }],
        author: 'revilo',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        number: 12,
        title: 'Fix: Webview rendering issues',
        description: 'Fixed styling and layout problems in webview',
        status: 'merged',
        isPR: true,
        labels: [{ name: 'bug', color: 'red' }, { name: 'documentation', color: 'blue' }],
        assignees: [{ name: 'Developer 2', login: 'dev2' }],
        author: 'revilo',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        commits: 3,
      },
      {
        number: 8,
        title: 'Refactor authentication module',
        description: 'Improve auth flow and token handling',
        status: 'open',
        isPR: true,
        labels: [{ name: 'critical', color: 'red' }],
        assignees: [{ name: 'Developer 1', login: 'dev1' }, { name: 'Developer 3', login: 'dev3' }],
        author: 'revilo',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        commits: 8,
      },
    ];
  }

  private _extractDevelopers(commits: GitCommit[]): Map<string, number> {
    const developers = new Map<string, number>();
    for (const commit of commits) {
      const count = developers.get(commit.author) || 0;
      developers.set(commit.author, count + 1);
    }
    return developers;
  }
}

function getWebviewOptions(
  extensionUri: vscode.Uri
): vscode.WebviewPanelOptions & vscode.WebviewOptions {
  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
  };
}
