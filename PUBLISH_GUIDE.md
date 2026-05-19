# Hylo VS Code 插件打包与发布指南 ✦

本文档将指引你如何将 `hylo-vscode` 插件打包并发布到 VS Code Marketplace，以供全球用户使用。

---

## 🛠️ 第一部分：我已为你做好的工作（自动就绪）

为了让插件达到官方发布标准，我已经自动为你完成了以下准备工作：

1. **补全 `package.json` 必要元数据**：
   - 关联了主仓库地址 `"repository"`、问题反馈地址 `"bugs"` 与项目主页 `"homepage"`。
   - 声明了 `"categories"`（其他、可视化）与 `"keywords"`，便于用户在市场中通过关键词检索。
2. **集成精美图标 (Icon)**：
   - 已将 Hylo 项目的圆角 squircle Logo 复制到插件包根目录中（`icon.png`）。
   - 在 `package.json` 中配置了 `"icon": "icon.png"`。
3. **配置打包忽略名单 (`.vscodeignore`)**：
   - 已为你屏蔽了 `src/` 源码、`tsconfig.json`、`esbuild.js` 等无关资源，确保最终打包生成的 `.vsix` 文件体积精简（不含无用源码）。
4. **编译并验证**：
   - 验证了 TypeScript 和 esbuild 打包链，项目可以无错生成 `dist/extension.js`。

---

## 📋 第二部分：你需要完成的步骤（人工操作）

发布插件涉及到微软账号和发布商管理，必须由你手动进行以下三个步骤：

### 步骤一：创建微软发布商账户与个人访问令牌 (PAT)

1. **注册并登录 Azure DevOps**：
   - 访问 [Azure DevOps (dev.azure.com)](https://dev.azure.com/)，使用你的微软账户登录并创建一个组织（Organization）。
2. **创建个人访问令牌 (PAT)**：
   - 登录后，点击页面右上角的 **User Settings** (用户图标旁的齿轮或清单图标) -> 选择 **Personal Access Tokens**。
   - 点击 **New Token**。
   - **名称 (Name)**：建议输入 `hylo-vscode-publish`。
   - **组织 (Organization)**：**必须选择 `All accessible organizations`**。
   - **过期时间 (Expiration)**：选择一个合适的有效期（默认 30 天，可设置为 90 天或更长）。
   - **作用域 (Scopes)**：点击页面底部的 **Show all scopes**，找到并选择 **`Marketplace -> Acquire & Manage`** (勾选该项即可，其他无需勾选)。
   - **复制令牌**：点击 **Create**，**立即复制生成的 Token 值**并保存到本地。关闭页面后你将无法再次查看该 Token。

### 步骤二：创建发布商 (Publisher)

1. 访问 [VS Code Marketplace 发布商管理页面](https://marketplace.visualstudio.com/manage)。
2. 使用同一个微软账户登录。
3. 点击 **Create Publisher**：
   - **Name**：发布商的友好显示名称。
   - **ID**：**最关键的字段**，对应 `package.json` 中的 `"publisher"`。
     - *当前我在 `package.json` 中默认填写的是 `"publisher": "ainx"`。如果你的发布商 ID 不是 `ainx`，请记得修改 `package.json` 中的 `publisher` 字段为你在网页端填写的 ID。*
   - 点击 **Create** 保存。

### 步骤三：本地一键发布

一切准备就绪后，你可以直接在终端中登录并发布插件。

请在电脑终端（确保已安装 `node` 和 `npm`）中，切换到 `hylo-vscode` 目录下执行：

```bash
# 1. 登录发布商账号（运行后会提示你输入上面步骤一中申请的 PAT 令牌）
npx @vscode/vsce login <你的PublisherID>

# 2. 本地自动打包并一键发布到应用市场
npx @vscode/vsce publish
```

---

## 📦 补充：本地打包离线安装（不公开发布）

如果你只是想自己或发给朋友离线使用，可以仅执行以下打包命令：

```bash
npx @vscode/vsce package
```

这会在根目录下生成 `hylo-vscode-0.1.0.vsix` 文件。在 VS Code 插件管理页点击 `...` -> 选择 `Install from VSIX...` 导入该文件即可。
