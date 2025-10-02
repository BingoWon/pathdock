# 数据迁移指南 (Data Migration Guide)

## 📋 概述

本扩展从 v0 升级到 v1 时，会自动迁移用户数据，无需手动操作。

## 🔄 迁移内容

### 旧数据格式 (v0)
```javascript
{
  "preferredRooms": "[{url, title, isPreferred: true}, null, ...]",  // 39个固定位置
  "allocatedRooms": "[{url, title, isPreferred}, ...]",              // 39个固定位置
  "ignoredSites": "[url1, url2, ...]"                                // 忽略的网站列表
}
```

### 新数据格式 (v1)
```javascript
{
  "version": 1,                                                       // 数据版本号
  "sites": "[{url, title, position, isPinned, visitCount}, ...]",   // 动态站点列表
  "ignoredUrls": "[url1, url2, ...]",                                // 忽略的网站列表
  "backup_v0": "{...}"                                               // 旧数据备份（安全保障）
}
```

## ✅ 迁移保证

1. **Pin 状态保留**：所有 pinned 的网站会保持在原位置
2. **忽略列表保留**：所有被忽略的网站列表完整保留
3. **数据备份**：旧数据会自动备份到 `backup_v0`
4. **自动执行**：首次加载新版本时自动运行，无需用户操作

## 🔍 迁移日志

打开浏览器控制台（F12），可以看到详细的迁移日志：

```
📦 Current data version: 0
🔄 Starting migration from v0 to v1...
🔄 Migrating v0 → v1: Converting old data format...
📊 Old data found: { preferredRooms: 15, allocatedRooms: 39, ignoredSites: 3 }
✅ Migration v0 → v1 completed: { migratedSites: 39, pinnedSites: 15, ignoredUrls: 3 }
💾 Old data backed up successfully
✅ Migration completed successfully!
✅ App initialized successfully
✨ Extension updated! Your pinned sites have been preserved.
```

## 🛡️ 安全措施

1. **备份机制**：旧数据会保存在 `backup_v0` 中
2. **错误处理**：迁移失败时会保留原数据
3. **URL 验证**：只迁移有效的 URL
4. **去重处理**：自动去除重复的网站

## 🔧 手动恢复（如果需要）

如果迁移出现问题，可以手动恢复：

1. 打开浏览器控制台（F12）
2. 运行以下代码：

```javascript
// 查看备份数据
chrome.storage.sync.get('backup_v0', (data) => {
    console.log('Backup data:', JSON.parse(data.backup_v0));
});

// 恢复旧数据（如果需要）
chrome.storage.sync.get('backup_v0', (data) => {
    const backup = JSON.parse(data.backup_v0);
    chrome.storage.sync.set({
        'preferredRooms': JSON.stringify(backup.preferredRooms),
        'allocatedRooms': JSON.stringify(backup.allocatedRooms),
        'ignoredSites': JSON.stringify(backup.ignoredSites),
        'version': 0  // 重置版本号
    }, () => {
        console.log('Restored from backup');
        location.reload();
    });
});
```

## 📊 迁移统计

迁移完成后，控制台会显示：
- 迁移的网站总数
- Pinned 网站数量
- 忽略的网站数量

## ❓ 常见问题

### Q: 迁移会丢失数据吗？
A: 不会。所有数据都会被保留，并且有备份。

### Q: 迁移需要多长时间？
A: 通常在 1 秒内完成，取决于数据量。

### Q: 可以回退到旧版本吗？
A: 可以。旧数据被备份在 `backup_v0` 中，可以手动恢复。

### Q: 迁移失败怎么办？
A: 扩展会保留原数据，可以尝试刷新页面重新迁移。

## 🎯 测试迁移

如果你想测试迁移功能：

1. 安装旧版本扩展
2. 添加一些 pinned 网站
3. 更新到新版本
4. 打开控制台查看迁移日志
5. 验证所有 pinned 网站是否保留

## 📝 版本历史

- **v0**: 初始版本，使用 `preferredRooms` + `allocatedRooms`
- **v1**: 重构版本，使用统一的 `sites` 数据结构

## 🔮 未来升级

如果将来有 v2、v3 等版本，迁移系统会自动处理：
- v0 → v1 → v2 → v3（逐步迁移）
- 每次迁移都会创建备份
- 版本号自动管理

## 💡 开发者注意事项

如果你要添加新的迁移版本：

1. 在 `MigrationManager` 中增加 `CURRENT_VERSION`
2. 添加新的迁移方法 `_migrateVxToVy()`
3. 在 `migrate()` 方法中添加条件判断
4. 更新此文档

示例：
```javascript
static CURRENT_VERSION = 2;

static async migrate() {
    const currentVersion = await StorageManager.getVersion();
    
    if (currentVersion < this.CURRENT_VERSION) {
        if (currentVersion === 0) {
            await this._migrateV0ToV1();
        }
        if (currentVersion <= 1) {
            await this._migrateV1ToV2();
        }
        
        await StorageManager.setVersion(this.CURRENT_VERSION);
    }
}
```

