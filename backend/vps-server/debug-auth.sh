#!/bin/bash

# Debug script to check authentication issues

echo "🔍 Debugging Authentication"
echo "═══════════════════════════"
echo ""

cd "$(dirname "$0")"

# Check if containers are running
echo "1. Checking containers..."
docker compose -f docker-compose.full.yml ps voicenote-api

echo ""
echo "2. Checking recent API logs..."
echo "   (Looking for 401 errors and user ID mismatches)"
echo ""
docker compose -f docker-compose.full.yml logs --tail=50 voicenote-api | grep -i "401\|unauthorized\|user" || echo "   No recent auth errors in logs"

echo ""
echo "3. Testing health endpoint..."
curl -s http://localhost:3333/health | jq . || curl -s http://localhost:3333/health

echo ""
echo "4. Checking database for users..."
echo "   Run this command to see all users in the database:"
echo ""
echo "   docker compose -f docker-compose.full.yml exec voicenote-api node -e \""
echo "     const Database = require('better-sqlite3');"
echo "     const db = new Database('/app/data/voicenotes.db');"
echo "     const users = db.prepare('SELECT id, email, is_admin FROM users').all();"
echo "     console.log(JSON.stringify(users, null, 2));"
echo "   \""
echo ""

echo "5. To manually add a user to the server database:"
echo "   docker compose -f docker-compose.full.yml exec voicenote-api node -e \""
echo "     const Database = require('better-sqlite3');"
echo "     const bcrypt = require('bcryptjs');"
echo "     const crypto = require('crypto');"
echo "     const db = new Database('/app/data/voicenotes.db');"
echo "     const email = 'YOUR_EMAIL@example.com';"
echo "     const password = 'YOUR_PASSWORD';"
echo "     const salt = bcrypt.genSaltSync(10);"
echo "     const hash = bcrypt.hashSync(password, salt);"
echo "     const id = crypto.randomUUID();"
echo "     db.prepare('INSERT INTO users (id, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, 0, ?)').run(id, email, hash, new Date().toISOString());"
echo "     console.log('User created with ID:', id);"
echo "   \""
echo ""

echo "════════════════════════════════════════"
echo "💡 Quick Fix:"
echo ""
echo "The easiest solution is to sign out and sign back in."
echo "The new code will automatically sync your user to the server."
echo ""
echo "If that doesn't work, you can manually create your user"
echo "on the server using the command in step 5 above."

