/**
 * Centralized logging utility for debugging agents and tools
 */

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    // Text colors
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
};

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogContext {
    component: string;  // e.g., 'PerformanceAgent', 'DataQueryTool'
    action: string;     // e.g., 'INPUT', 'OUTPUT', 'PLAN', 'EXECUTE'
}

/**
 * Truncate long strings for readable logs
 */
function truncate(text: string, maxLines: number = 20): string {
    const lines = text.split('\n');
    if (lines.length <= maxLines) {
        return text;
    }
    const truncated = lines.slice(0, maxLines).join('\n');
    return `${truncated}\n... [${lines.length - maxLines} more lines truncated]`;
}

/**
 * Format an object for logging (handles nested objects, truncates arrays)
 */
function formatValue(value: any, maxArrayItems: number = 5): string {
    if (value === null || value === undefined) {
        return String(value);
    }
    
    if (typeof value === 'string') {
        return truncate(value);
    }
    
    if (Array.isArray(value)) {
        if (value.length <= maxArrayItems) {
            return JSON.stringify(value, null, 2);
        }
        const preview = value.slice(0, maxArrayItems);
        return `${JSON.stringify(preview, null, 2)}\n... [${value.length - maxArrayItems} more items]`;
    }
    
    if (typeof value === 'object') {
        return truncate(JSON.stringify(value, null, 2));
    }
    
    return String(value);
}

/**
 * Format parameters for logging
 */
function formatParams(params: Record<string, any>): string {
    const lines = Object.entries(params).map(([key, value]) => {
        const formatted = formatValue(value);
        // Indent multi-line values
        if (formatted.includes('\n')) {
            const indented = formatted.split('\n').map(l => `    ${l}`).join('\n');
            return `  ${key}:\n${indented}`;
        }
        return `  ${key}: ${formatted}`;
    });
    return lines.join('\n');
}

/**
 * Get timestamp string
 */
function getTimestamp(): string {
    return new Date().toISOString().slice(11, 23); // HH:mm:ss.sss
}

/**
 * Main logger class
 */
class Logger {
    private getColor(level: LogLevel): string {
        switch (level) {
            case 'ERROR': return COLORS.red;
            case 'WARN': return COLORS.yellow;
            case 'DEBUG': return COLORS.dim;
            default: return COLORS.white;
        }
    }

    private getComponentColor(component: string): string {
        // Different colors for different component types
        if (component.includes('Agent') || component.includes('Orchestrator')) {
            return COLORS.magenta;
        }
        if (component.includes('Tool')) {
            return COLORS.cyan;
        }
        return COLORS.blue;
    }

    private getActionColor(action: string): string {
        switch (action.toUpperCase()) {
            case 'INPUT': return COLORS.yellow;
            case 'OUTPUT': return COLORS.green;
            case 'ERROR': return COLORS.red;
            case 'START': return COLORS.blue;
            case 'END': return COLORS.blue;
            default: return COLORS.white;
        }
    }

    /**
     * Log with structured format
     */
    log(level: LogLevel, context: LogContext, message: string, data?: Record<string, any>) {
        const timestamp = getTimestamp();
        const levelColor = this.getColor(level);
        const componentColor = this.getComponentColor(context.component);
        const actionColor = this.getActionColor(context.action);

        // Header line
        console.log(
            `${COLORS.dim}${timestamp}${COLORS.reset} ` +
            `${levelColor}[${level}]${COLORS.reset} ` +
            `${componentColor}${COLORS.bright}[${context.component}]${COLORS.reset} ` +
            `${actionColor}${context.action}${COLORS.reset}: ${message}`
        );

        // Data if provided
        if (data && Object.keys(data).length > 0) {
            console.log(COLORS.dim + formatParams(data) + COLORS.reset);
        }
    }

    /**
     * Log agent start
     */
    agentStart(agentName: string, params: Record<string, any>) {
        console.log(`\n${COLORS.bgBlue}${COLORS.white} AGENT START: ${agentName} ${COLORS.reset}`);
        this.log('INFO', { component: agentName, action: 'INPUT' }, 'Parameters received:', params);
    }

    /**
     * Log agent end
     */
    agentEnd(agentName: string, result: Record<string, any>) {
        this.log('INFO', { component: agentName, action: 'OUTPUT' }, 'Result:', result);
        console.log(`${COLORS.bgGreen}${COLORS.white} AGENT END: ${agentName} ${COLORS.reset}\n`);
    }

    /**
     * Log tool input
     */
    toolInput(toolName: string, input: string) {
        this.log('INFO', { component: toolName, action: 'INPUT' }, 'Processing:', { input: truncate(input, 15) });
    }

    /**
     * Log tool output
     */
    toolOutput(toolName: string, output: string, durationMs?: number) {
        const duration = durationMs ? ` (${durationMs}ms)` : '';
        this.log('INFO', { component: toolName, action: 'OUTPUT' }, `Completed${duration}:`, { output: truncate(output, 20) });
    }

    /**
     * Log tool error
     */
    toolError(toolName: string, error: any) {
        this.log('ERROR', { component: toolName, action: 'ERROR' }, 'Failed:', { 
            error: error.message || String(error) 
        });
    }

    /**
     * Log plan creation
     */
    plan(component: string, tasks: Array<{ id: string; description: string; tool: string }>) {
        this.log('INFO', { component, action: 'PLAN' }, `Created ${tasks.length} tasks:`, {
            tasks: tasks.map(t => `[${t.tool}] ${t.description}`)
        });
    }

    /**
     * Log task execution
     */
    taskStart(component: string, taskId: string, taskDescription: string, tool: string) {
        this.log('INFO', { component, action: 'TASK_START' }, `${taskId}: ${taskDescription}`, { tool });
    }

    taskEnd(component: string, taskId: string, result: string) {
        this.log('INFO', { component, action: 'TASK_END' }, `${taskId} completed`, { result: truncate(result, 10) });
    }

    /**
     * Log routing decision
     */
    route(decision: Record<string, any>) {
        this.log('INFO', { component: 'Orchestrator', action: 'ROUTE' }, 'Decision made:', decision);
    }

    /**
     * Log guardrail check
     */
    guardrail(input: string, passed: boolean, reason?: string) {
        const level: LogLevel = passed ? 'INFO' : 'WARN';
        const status = passed ? 'PASSED' : 'BLOCKED';
        this.log(level, { component: 'Guardrails', action: status }, truncate(input, 3), 
            reason ? { reason } : undefined
        );
    }

    /**
     * Log session info
     */
    session(sessionId: string, action: 'CREATE' | 'ACCESS' | 'DELETE') {
        this.log('INFO', { component: 'Session', action }, `Session: ${sessionId}`);
    }

    /**
     * Generic debug log
     */
    debug(component: string, message: string, data?: Record<string, any>) {
        this.log('DEBUG', { component, action: 'DEBUG' }, message, data);
    }

    /**
     * Separator for readability
     */
    separator(label?: string) {
        const line = '─'.repeat(60);
        if (label) {
            console.log(`\n${COLORS.dim}${line} ${label} ${line}${COLORS.reset}\n`);
        } else {
            console.log(`${COLORS.dim}${line}${COLORS.reset}`);
        }
    }
}

// Export singleton instance
export const logger = new Logger();

