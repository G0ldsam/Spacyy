// Type check script that filters out shared folder errors
// (shared folder is checked during Next.js build)
const { execSync } = require('child_process')

try {
  const output = execSync('tsc --noEmit --skipLibCheck', { 
    encoding: 'utf8',
    stdio: 'pipe'
  })
  console.log(output)
} catch (error) {
  const output = error.stdout || error.stderr || ''
  const lines = output.split('\n')
  const filtered = lines.filter(line => !line.includes('../shared'))
  
  if (filtered.length > 0 && filtered.some(line => line.trim())) {
    console.error(filtered.join('\n'))
    process.exit(1)
  }
  // If only shared folder errors, exit successfully
  process.exit(0)
}
