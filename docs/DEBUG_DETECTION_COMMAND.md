# Debug Detection Command

The `debug-detection` command is a powerful CLI tool for testing and debugging the IELTS appointment detection algorithm. It provides detailed analysis of how the system detects appointments, which selectors work, and why certain appointments are classified as available or filled.

## Usage

```bash
ielts-monitor debug-detection [options]
```

## Options

- `-u, --url <url>` - Custom URL to test detection against
- `-c, --city <cities>` - Comma-separated list of cities to scan
- `-e, --exam-model <models>` - Comma-separated list of exam models  
- `-m, --months <months>` - Comma-separated list of months (1-12)
- `-d, --detailed` - Show detailed detection analysis including selectors and confidence scores
- `-j, --json` - Output results in JSON format for automation
- `--show-html` - Display raw HTML snippets for manual inspection
- `--test-server` - Use local test simulation server (localhost:3001)

## Examples

### Basic Detection Test
```bash
ielts-monitor debug-detection
```
Uses default configuration to test detection against the configured IELTS website.

### Test Against Custom URL
```bash
ielts-monitor debug-detection --url "https://example.com/appointments"
```

### Detailed Analysis with HTML Output
```bash
ielts-monitor debug-detection --detailed --show-html
```
Shows detailed selector performance, status detection reasoning, and raw HTML snippets.

### Test with Specific Filters
```bash
ielts-monitor debug-detection --city "Isfahan,Tehran" --exam-model "IELTS" --months "1,2,3"
```

### Test Against Local Simulation Server
```bash
ielts-monitor debug-detection --test-server --detailed
```
Useful for testing detection logic against known appointment data.

### JSON Output for Automation
```bash
ielts-monitor debug-detection --json > detection-results.json
```

## Output Sections

### 1. Detection Results Summary
- Detection status (available/filled/no-slots)
- Total elements found
- Available vs filled appointment counts
- Processing time

### 2. Detection Strategy Analysis (--detailed)
- Selector performance showing which CSS selectors worked
- Processing time for each selector strategy
- Success rates for different detection methods

### 3. Status Detection Decisions (--detailed)
- Individual appointment status decisions
- Indicators that led to each decision (CSS classes, text content, etc.)
- Confidence scores for each decision
- Reasoning behind status classification

### 4. Validation Results (--detailed)
- Validation checks performed on detection results
- Pass/fail status for each validation
- Details about any issues found

### 5. Detected Appointments
- List of available appointments with details
- List of filled appointments (limited unless --detailed)
- Raw HTML snippets (if --show-html enabled)

### 6. Parsing Notes and Errors (--detailed)
- Detailed parsing notes from the detection process
- Any errors encountered during parsing
- Context information for debugging

### 7. Debug Recommendations
- Suggestions based on detection results
- Troubleshooting tips for common issues
- Next steps for improving detection accuracy

## Troubleshooting

### No Appointments Detected
- Check if website structure has changed
- Try `--test-server` flag to test with known data
- Use `--detailed` to see which selectors are being tried

### All Appointments Show as Filled
- Use `--show-html` to examine status indicators
- Check if Persian text detection is working correctly
- Verify CSS class detection logic

### Detection Errors
- Check browser installation (Chromium/Chrome required)
- Verify network connectivity to target URL
- Use `--detailed` to see specific error messages

## Integration with Other Commands

The debug command works well with other CLI commands:

```bash
# Run debug, then check inspection data
ielts-monitor debug-detection --detailed
ielts-monitor inspect --detailed

# Compare with regular appointment scan
ielts-monitor appointment-scan --detailed
ielts-monitor debug-detection --detailed

# Check logs for more details
ielts-monitor logs --follow
```

## Requirements Fulfilled

This command fulfills the following requirements:

- **Requirement 2.4**: Provides summary of detection patterns and results
- **Requirement 2.5**: Saves inspection data with element selectors and parsing notes  
- **Requirement 6.3**: Documents decision-making process and fallback logic
- **Requirement 6.5**: Provides comprehensive parsing logs with element details

The command enables developers and users to:
1. Test detection against live websites or test servers
2. See detailed reasoning for each appointment's status classification
3. Identify which selectors work and which fail
4. Validate detection accuracy manually
5. Debug issues when appointments are missed or misclassified