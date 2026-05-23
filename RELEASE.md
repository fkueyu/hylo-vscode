# Release Guide

This project publishes the same VSIX package to both:

- VS Code Marketplace
- Open VSX Registry

The automated release workflow is defined in:

```text
.github/workflows/publish.yml
```

## One-Time Setup

Add these GitHub Actions secrets in the GitHub repository:

```text
VSCE_PAT
OVSX_PAT
```

You can set them from the local terminal with GitHub CLI:

```bash
gh secret set VSCE_PAT
gh secret set OVSX_PAT
```

`VSCE_PAT` is the VS Code Marketplace / Azure DevOps Personal Access Token.
`OVSX_PAT` is the Open VSX access token.

## Normal Release

Run these commands from the repository root:

```bash
npm version patch
git push
git push --tags
```

`npm version patch` updates `package.json` and `package-lock.json`, creates a version commit, and creates a tag such as `v0.1.5`.

When the `v*.*.*` tag is pushed, GitHub Actions automatically:

1. Installs dependencies with `npm ci`.
2. Builds the extension.
3. Packages one `extension.vsix`.
4. Publishes that same VSIX to VS Code Marketplace.
5. Publishes that same VSIX to Open VSX.

Use `npm version minor` or `npm version major` instead of `patch` when the release type requires it.

## Manual Workflow Run

You can also publish from the GitHub website:

1. Open the repository on GitHub.
2. Go to Actions.
3. Select `Publish Extension`.
4. Click `Run workflow`.
5. Choose whether to publish to VS Code Marketplace, Open VSX, or both.

Manual runs publish the version currently in `package.json`.

## Local Package Check

Before publishing, you can verify the package locally:

```bash
npm run build
npm run package
```

The package should contain only runtime files such as:

```text
dist/
media/
package.json
README.md
LICENSE.txt
icon.png
```

The ignore rules are in:

```text
.vscodeignore
```

## Manual Publish Commands

If GitHub Actions is unavailable, publish manually:

```bash
npm run build
npx vsce package -o extension.vsix
```

### 1. Publish to VS Code Marketplace
* **First time (save token to Keychain)**:
  ```bash
  npx @vscode/vsce login AINX
  ```
* **Subsequent runs (one-click publish without token parameter)**:
  ```bash
  npx @vscode/vsce publish --packagePath extension.vsix
  ```

### 2. Publish to Open VSX Registry
* **Option A: With temporary token parameter**:
  ```bash
  npx ovsx@0.10.12 publish extension.vsix -p "YOUR_OVSX_PAT"
  ```
* **Option B: With environment variable (recommended)**:
  If you have configured `OVSX_PAT` in your shell profile (e.g. `export OVSX_PAT="your-token"` in `~/.zshrc`), you can publish directly:
  ```bash
  npx ovsx@0.10.12 publish extension.vsix
  ```

Do not reuse an already published version number. Increase `version` first.

## Current Published Extension

Open VSX:

```text
https://open-vsx.org/extension/AINX/hylo-html-preview
```

VS Code Marketplace item name should be:

```text
AINX.hylo-html-preview
```

This depends on the VS Code Marketplace publisher ID being `AINX`.

## Open VSX Namespace Verification

Open VSX namespace ownership was requested here:

```text
https://github.com/EclipseFdn/open-vsx.org/issues/10483
```

Until the `AINX` namespace is verified, Open VSX can show a warning that `fkueyu` is not a verified publisher of `AINX`. This does not block search, download, or install.

## Troubleshooting

If GitHub Actions fails on VS Code Marketplace publishing:

- Check that `VSCE_PAT` exists and is not expired.
- Check that the VS Code Marketplace publisher ID matches `publisher` in `package.json`.
- Check that the version has not already been published.

If GitHub Actions fails on Open VSX publishing:

- Check that `OVSX_PAT` exists and is not expired.
- Check that the `AINX` namespace exists.
- Check that the version has not already been published.

If the extension is not searchable immediately after publishing:

- Wait a few minutes for marketplace indexing.
- Verify direct metadata first:

```bash
curl -s https://open-vsx.org/api/AINX/hylo-html-preview
```
