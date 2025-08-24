# GitHub Actions Setup

This project includes automatic npm publishing via GitHub Actions. When you push to the main branch, the workflow will:

1. **Test**: Run linting, tests, and build
2. **Version Check**: Compare current version with published version
3. **Publish**: Automatically publish to npm if version changed
4. **Release**: Create a GitHub release with the new version

## Required GitHub Secrets

You need to configure the following secret in your GitHub repository:

### NPM_AUTOMATION_TOKEN

1. Go to [npmjs.com](https://www.npmjs.com) and log in
2. Go to Access Tokens in your account settings
3. Generate a new **Automation** token (this bypasses 2FA)
4. Copy the token value

**Setting up the secret:**

1. Go to your GitHub repository: `https://github.com/gilberth/mcp-unifi-network`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_AUTOMATION_TOKEN`
5. Value: Your npm automation token (starts with `npm_`)
6. Click **Add secret**

## Workflow Behavior

### On Pull Request
- Runs tests and linting
- Builds the project
- **Does NOT publish to npm**

### On Push to Main
- Runs tests and linting
- Builds the project
- Checks if package.json version differs from published npm version
- **Only publishes if version has changed**
- Creates a GitHub release if published

## Publishing New Versions

### Method 1: Manual Version Bump
```bash
# Edit package.json and change the version number
# Then commit and push
git add package.json
git commit -m "bump version to 1.4.2"
git push
```

### Method 2: Using npm Scripts
```bash
# Patch version (1.4.1 → 1.4.2)
npm run publish:patch

# Minor version (1.4.1 → 1.5.0)
npm run publish:minor

# Major version (1.4.1 → 2.0.0)
npm run publish:major
```

### Method 3: Direct npm version
```bash
npm version patch && git push --follow-tags
npm version minor && git push --follow-tags
npm version major && git push --follow-tags
```

## Workflow Files

- **`.github/workflows/npm-publish.yml`**: Main workflow for testing and publishing
- **`.nvmrc`**: Specifies Node.js version (20)

## Package Information

- **Package Name**: `@thelord/unifi-mcp-server`
- **Current Version**: Check `package.json`
- **npm Registry**: https://registry.npmjs.org/
- **Package URL**: https://www.npmjs.com/package/@thelord/unifi-mcp-server

## Troubleshooting

### Publishing Failed
1. Check that `NPM_AUTOMATION_TOKEN` secret is set correctly
2. Verify the token has publish permissions
3. Ensure package.json version is higher than current published version

### Tests Failed
1. Check the Actions tab for detailed error messages
2. Run tests locally: `npm test`
3. Run linting locally: `npm run lint`

### Version Not Publishing
The workflow only publishes when the version in `package.json` is different from the version published on npm. If versions are the same, it will skip publishing.