# Hylo VS Code 插件 Open VSX 发布指南

本文档用于把 `hylo-vscode` 发布到 [Open VSX Registry](https://open-vsx.org/)。

## 1. 发布前准备

Open VSX 发布需要先完成账号和协议步骤：

1. 注册 Eclipse 账号，并在资料里填写和 Open VSX 登录一致的 GitHub 用户名。
2. 登录 open-vsx.org，进入头像 -> Settings。
3. 连接 Eclipse 账号，并签署 Publisher Agreement。
4. 在 Settings -> Access Tokens 里生成 token。token 只显示一次，请妥善保存。

官方文档：https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions

## 2. 本地构建和打包

```bash
npm install
npm run package
```

打包产物：

```text
extension.vsix
```

`package.json` 已配置 `vscode:prepublish`，因此每次打包或从源码发布前都会自动执行构建。

## 3. 创建 namespace

`package.json` 当前 publisher 是：

```json
"publisher": "AINX"
```

首次发布前，需要在 Open VSX 创建同名 namespace：

```bash
npx ovsx create-namespace AINX -p <OPEN_VSX_TOKEN>
```

如果 namespace 已存在，可以跳过此步。若要显示 verified publisher 标识，还需要按 Open VSX 的 namespace ownership 流程认领。

## 4. 本地发布

推荐发布已打包的 VSIX：

### 4.1 发布到 VS Code Marketplace (官方市场)
* **首次登录** (在本地保存凭证至钥匙串)：
  ```bash
  npx @vscode/vsce login AINX
  ```
* **后续一键发布** (直接免 Token 发布)：
  ```bash
  npx @vscode/vsce publish --packagePath extension.vsix
  ```

### 4.2 发布到 Open VSX Registry
* **方式 A：使用临时 Token 发布**：
  ```bash
  npx ovsx publish extension.vsix -p <OPEN_VSX_TOKEN>
  ```
* **方式 B：使用系统环境变量自动发布** (推荐)：
  如果您已在本地的 shell 配置（如 `~/.zshrc`）中添加了 `export OVSX_PAT="你的TOKEN"`，则可以直接运行免密发布：
  ```bash
  npx ovsx publish extension.vsix
  ```

发布成功后，插件地址应为：
* 官方商店: `https://marketplace.visualstudio.com/items?itemName=AINX.hylo-html-preview`
* Open VSX: `https://open-vsx.org/extension/AINX/hylo-html-preview`

## 5. 自动发布

仓库已配置 GitHub Actions：`.github/workflows/publish.yml`。

需要在 GitHub 仓库 Settings -> Secrets and variables -> Actions 中添加两个 secret：

```text
VSCE_PAT=<VS Code Marketplace token>
OVSX_PAT=<Open VSX token>
```

发布新版本：

```bash
npm version patch
git push
git push --tags
```

推送 `v*.*.*` tag 后，workflow 会自动发布到 VS Code Marketplace 和 Open VSX。

也可以在 GitHub Actions 页面手动运行 `Publish Extension`，并选择只发布其中一个市场。

完整的日常发布流程记录在 `RELEASE.md`。
