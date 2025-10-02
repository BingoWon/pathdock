# Extension ID and Sync

## Fixed Extension ID

This extension uses a fixed public key in `manifest.json` to ensure the extension ID remains consistent across all devices.

**Extension ID**: `jmhbpnkfbfpgdmciogfnhbjbkpjdmhnn`

## Why This Matters

Chrome's `storage.sync` API only syncs data for extensions with the **same extension ID**. 

### Problem with Unpacked Extensions

When loading an unpacked extension:
- Different computers generate different extension IDs
- Extension ID is based on the local file path
- Different IDs = separate storage = **no sync**

### Solution: Fixed Public Key

By adding a `key` field to `manifest.json`:
- Extension ID is derived from the public key
- Same key = same ID on all devices
- Same ID = storage.sync works correctly ✅

## How It Works

```
Device A:
- Loads extension with key
- Extension ID: jmhbpnkfbfpgdmciogfnhbjbkpjdmhnn
- Saves data to chrome.storage.sync["jmhbpnkfbfpgdmciogfnhbjbkpjdmhnn"]

Device B:
- Loads extension with same key
- Extension ID: jmhbpnkfbfpgdmciogfnhbjbkpjdmhnn (same!)
- Reads data from chrome.storage.sync["jmhbpnkfbfpgdmciogfnhbjbkpjdmhnn"]

Result: Sync works! 🎉
```

## Testing Sync

1. **Load extension on Device A**
   - Go to `chrome://extensions`
   - Verify Extension ID: `jmhbpnkfbfpgdmciogfnhbjbkpjdmhnn`
   - Pin a site

2. **Load extension on Device B**
   - Go to `chrome://extensions`
   - Verify Extension ID: `jmhbpnkfbfpgdmciogfnhbjbkpjdmhnn` (should match!)
   - Wait 5-10 seconds
   - Check if site is pinned

3. **Verify in Console**
   ```javascript
   // Check extension ID
   chrome.runtime.id
   // Should output: "jmhbpnkfbfpgdmciogfnhbjbkpjdmhnn"
   
   // Check storage
   chrome.storage.sync.get('sites', (data) => {
       console.log(data);
   });
   ```

## Important Notes

- ✅ Extension ID is now fixed across all devices
- ✅ `storage.sync` will work correctly
- ✅ No code changes needed
- ⚠️ Must use the same extension files on all devices
- ⚠️ Reloading the extension will keep the same ID

## Security

The public key in `manifest.json` is safe to share publicly. It only determines the extension ID and cannot be used to impersonate or modify the extension.

