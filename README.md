# USST 智慧教室直录播云代理

## 📖 简介

本项目是专为 **上海理工大学智慧教室直录播平台** 设计的轻量级代理工具。

### 核心价值

-   **隐私保护**：无需分享你的学号与密码，即可让同学通过代理地址观看你的课程。
-   **鉴权转发**：代理服务器代为完成平台登录并转发流媒体请求。
-   **灵活部署**：支持本地运行，可配合隧道技术实现安全公网访问。

## 🛠️ 快速开始

本项目提供两种运行方式：

### 方式一：直接运行可执行文件（推荐）

1. **下载程序**：前往 [Releases](../../releases) 页面，下载对应操作系统的可执行文件。
2. **启动程序**：
    - **Windows**: 双击运行 `usst-course-bridge-windows.exe`。
    - **macOS / Linux**: 在终端执行 `./usst-course-bridge-[os]`（可能需要先执行 `chmod +x` 赋予权限）。
3. **配置环境（可选）**：参考下方的项目配置，手动创建 `.env` 文件。若不配置，程序启动后会交互式提示输入。

### 方式二：通过源代码运行

1. **环境准备**：确保你的系统中已安装 [Deno](https://deno.land/manual/getting_started/installation)。

    ```bash
    # Windows (PowerShell)
    irm https://deno.land/install.ps1 | iex

    # macOS / Linux
    curl -fsSL https://deno.land/x/install/install.sh | sh
    ```

2. **运行项目**：
    ```bash
    git clone https://github.com/BobLiu20/USST-CourseBridge.git
    cd USST-CourseBridge
    deno task run
    ```

## ⚙️ 项目配置（可选）

复制环境模板并编辑用户信息：

```bash
cp .env.example .env
```

使用编辑器打开 `.env`，配置环境变量：

| 配置项          | 说明                                                   |
| --------------- | ------------------------------------------------------ |
| `USST_USERNAME` | 统一身份认证账号（学号）。未配置时将在启动后提示输入。 |
| `USST_PASSWORD` | 统一身份认证密码。未配置时将在启动后提示输入。         |
| `USST_REALNAME` | 用于将页面中的真名替换成“USST”。未填时禁用替换功能。   |
| `HOSTNAME`      | 监听地址。默认为 `0.0.0.0`。                           |
| `PORT`          | 监听端口。默认为 `1906`。                              |

> [!TIP]
>
> 为了安全起见，推荐在启动后根据提示输入密码，而非将其写入配置文件。

## 🚀 启动与运维管理

通过源代码运行时，支持前台运行，也可通过 [`pm2`](https://pm2.keymetrics.io/) 进行后台托管运行。

### 基本启动

-   **前台运行**：
    ```bash
    deno task run
    ```
-   **后台运行**：
    ```bash
    deno task start
    ```

> [!CAUTION]
>
> **安全警告**：请务必在受信任的机器上运行此程序。严禁将包含真实密码的 `.env` 文件上传至 GitHub 等公共代码仓库。

### 后台运维指令

当通过 `deno task start` 将服务托管至后台后，你可以使用以下指令进行运维管理：

| 操作             | 指令              |
| ---------------- | ----------------- |
| **查看实时日志** | `deno task logs`  |
| **监控资源占用** | `deno task monit` |
| **停止服务**     | `deno task stop`  |

## 🌐 网络访问与安全

### 局域网访问

如果你希望在室内局域网内与伙伴分享，可以将 `HOSTNAME` 设置为 `0.0.0.0`。

随后，同一局域网下的设备可以通过 `http://[计算机名].local:1906` 访问（例如 `http://my-laptop.local:1906`）。

### 公网访问建议

为了在校外或跨网络访问，建议通过隧道技术暴露服务。推荐使用 Cloudflare 生态。

1. **建立隧道 (Tunnel)**：使用 [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) 穿透内网，无需公网 IP 即可访问。
2. **访问控制 (Access)**：配合 [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/identity/) 增加一层验证（如邮箱验证码，并配置邮箱白名单），确保只有你允许的人能访问代理地址。

## 🤝 贡献与反馈

如果你在安装或使用过程中遇到问题，欢迎提交 Issue。
