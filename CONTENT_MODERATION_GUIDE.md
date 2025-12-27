# Content Moderation Feature - Implementation Guide

## Overview
This document describes the Content Moderation feature implementation for VoiceVault's admin control panel. This feature allows administrators to review and moderate user-generated content, including pending song submissions and reported issues.

## 🔒 Security Features

### Admin-Only Access
- **Frontend Protection**: The ContentModerationScreen checks admin status using `useAdminStatus()` hook
- **Navigation Guard**: Non-admin users are automatically redirected to the Search screen
- **Backend Protection**: All SQL functions verify admin status before execution
- **RLS Policies**: Row-Level Security policies enforce admin-only access at the database level

### Security Layers
1. **UI Level**: React component checks `isAdmin` before rendering
2. **Navigation Level**: Navigation type safety prevents unauthorized route access
3. **Function Level**: Each SQL function validates `admins` table membership
4. **Database Level**: RLS policies provide final security enforcement

## 📁 Files Added/Modified

### New Files Created
1. **`app/screens/ContentModerationScreen/ContentModerationScreen.tsx`**
   - Main content moderation interface
   - Tab-based UI for pending songs and issues
   - Approve/reject/resolve actions

2. **`supabase/migrations/20251217_add_content_moderation.sql`**
   - SQL migration with moderation functions
   - New RLS policies (non-destructive)
   - Admin-only access enforcement

### Modified Files
1. **`app/navigation/StackNavigator.tsx`**
   - Added ContentModerationScreen import
   - Added route definition
   - Updated navigation types

2. **`app/navigation/types.ts`**
   - Added `ContentModerationScreen: undefined` to RootStackParamList
   - Ensures TypeScript type safety

3. **`app/screens/ProfileScreen/AdminProfileScreen.tsx`**
   - Updated `handleContentModeration()` to navigate to the new screen
   - Removed placeholder alert

## 🛠️ SQL Functions Added

### 1. `admin_reject_pending_song(p_pending_song_id UUID)`
**Purpose**: Reject a pending song submission
**Security**: Active admin required
**Action**: 
- Updates `pending_songs.status` to 'rejected'
- Records `reviewed_by` (admin user_id)
- Records `reviewed_at` (timestamp)

**Usage**:
```sql
SELECT admin_reject_pending_song('song-uuid-here');
```

### 2. `admin_resolve_issue(p_issue_id UUID)`
**Purpose**: Mark an issue as resolved
**Security**: Active admin required
**Action**:
- Updates `issues.status` to 'resolved'
- Updates `updated_at` timestamp

**Usage**:
```sql
SELECT admin_resolve_issue('issue-uuid-here');
```

### 3. `admin_delete_pending_song(p_pending_song_id UUID)`
**Purpose**: Permanently delete a pending song
**Security**: Active admin required
**Warning**: ⚠️ Irreversible action
**Action**: Deletes the record from `pending_songs` table

**Usage**:
```sql
SELECT admin_delete_pending_song('song-uuid-here');
```

### 4. `admin_delete_issue(p_issue_id UUID)`
**Purpose**: Permanently delete an issue
**Security**: Active admin required
**Warning**: ⚠️ Irreversible action
**Action**: Deletes the record from `issues` table

**Usage**:
```sql
SELECT admin_delete_issue('issue-uuid-here');
```

## 🔐 RLS Policies Added

### Pending Songs Table
- **Policy**: "Admins can delete pending songs"
- **Operation**: DELETE
- **Condition**: User must be in `admins` table with `is_active = true`
- **Impact**: Allows admins to remove pending songs without breaking existing user policies

### Issues Table
- **Policy**: "Admins can view all issues"
- **Operation**: SELECT
- **Condition**: User must be in `admins` table with `is_active = true`
- **Impact**: Allows admins to see all issues (required for moderation interface)

- **Policy**: "Admins can update issues"
- **Operation**: UPDATE
- **Condition**: User must be in `admins` table with `is_active = true`
- **Impact**: Allows admins to change issue status (e.g., mark as resolved)

- **Policy**: "Admins can delete issues"
- **Operation**: DELETE
- **Condition**: User must be in `admins` table with `is_active = true`
- **Impact**: Allows admins to remove issues from the system

### ✅ Existing Policies Preserved
The migration **does not modify or drop** any existing RLS policies. It only adds new policies using conditional creation (checks if policy exists before creating).

## 🎨 UI Features

### Two-Tab Interface
1. **Pending Songs Tab**
   - Lists all pending song submissions awaiting review
   - Shows song name, artist, vocal range, submitter, and submission date
   - Actions: Approve, Reject

2. **Open Issues Tab**
   - Lists all unresolved issues submitted by users
   - Shows issue subject, description, and creation date
   - Actions: Resolve

### Features
- **Pull-to-refresh**: Swipe down to reload data
- **Empty states**: Clear messages when no items to review
- **Confirmation dialogs**: Prevents accidental approvals/rejections
- **Error handling**: User-friendly error messages
- **Responsive design**: Works on all screen sizes
- **Theme support**: Respects app's light/dark theme settings

## 📊 Database Schema Requirements

### Required Tables
The feature uses these existing tables:

1. **`admins`** (must exist)
   - `user_id` (UUID, references auth.users)
   - `is_active` (BOOLEAN)
   - `role` (TEXT, optional)

2. **`pending_songs`** (must exist)
   - `id` (UUID, primary key)
   - `name` (TEXT)
   - `artist` (TEXT)
   - `vocal_range` (TEXT)
   - `username` (TEXT)
   - `user_id` (UUID)
   - `status` (TEXT: 'pending', 'approved', 'rejected')
   - `reviewed_by` (UUID, nullable)
   - `reviewed_at` (TIMESTAMP, nullable)
   - `created_at` (TIMESTAMP)

3. **`issues`** (must exist)
   - `id` (UUID, primary key)
   - `user_id` (UUID)
   - `subject` (TEXT)
   - `description` (TEXT)
   - `status` (TEXT: 'open', 'resolved')
   - `created_at` (TIMESTAMP)
   - `updated_at` (TIMESTAMP)

## 🚀 Deployment Steps

### 1. Apply SQL Migration
```bash
# In Supabase Dashboard > SQL Editor
# Run the file: supabase/migrations/20251217_add_content_moderation.sql
```

**Expected Output**:
```
✅ Created policy: Admins can delete pending songs
✅ Created policy: Admins can update issues
✅ Created policy: Admins can delete issues
✅ Content moderation functions and policies added successfully!
```

### 2. Verify Functions Created
```sql
-- Check that all 4 functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name LIKE 'admin_%' 
AND routine_schema = 'public';
```

### 3. Verify RLS Policies
```sql
-- Check new policies are present
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('pending_songs', 'issues')
AND policyname LIKE '%Admin%';
```

### 4. Test Admin Access
As an admin user (exists in `admins` table with `is_active = true`):
```typescript
// In your app, navigate to Admin Profile > Content Moderation
// You should see the moderation interface
```

### 5. Test Non-Admin Blocking
As a regular user (NOT in `admins` table):
```typescript
// Try to access ContentModerationScreen
// Should be automatically redirected to Search screen
```

## 🧪 Testing Checklist

### Frontend Tests
- [ ] Admin user can navigate to Content Moderation screen
- [ ] Non-admin user is redirected away from Content Moderation screen
- [ ] Pending Songs tab displays correctly
- [ ] Open Issues tab displays correctly
- [ ] Pull-to-refresh works
- [ ] Approve button shows confirmation dialog
- [ ] Reject button shows confirmation dialog
- [ ] Resolve button shows confirmation dialog
- [ ] Empty state displays when no items
- [ ] Error messages display correctly
- [ ] Theme colors apply correctly

### Backend Tests
- [ ] `admin_reject_pending_song()` works for admins
- [ ] `admin_reject_pending_song()` fails for non-admins
- [ ] `admin_resolve_issue()` works for admins
- [ ] `admin_resolve_issue()` fails for non-admins
- [ ] `admin_delete_pending_song()` works for admins (use with caution!)
- [ ] `admin_delete_issue()` works for admins (use with caution!)
- [ ] RLS policies allow admin DELETE on pending_songs
- [ ] RLS policies allow admin UPDATE on issues
- [ ] RLS policies allow admin DELETE on issues
- [ ] Existing user policies still work correctly

### Security Tests
- [ ] Non-admin cannot call admin functions directly
- [ ] Non-admin cannot access moderation data via API
- [ ] Admin status is verified at each function call
- [ ] RLS policies enforce database-level security
- [ ] Inactive admins (`is_active = false`) are blocked

## 🐛 Troubleshooting

### Issue: "Access denied" when admin tries to use moderation
**Solution**: Verify admin user:
```sql
SELECT * FROM admins WHERE user_id = auth.uid();
-- Should return a row with is_active = true
```

### Issue: Pending songs not loading
**Solution**: Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'pending_songs';
-- Should include "Admins can view all pending songs" policy
```

### Issue: TypeScript errors in navigation
**Solution**: Ensure `ContentModerationScreen: undefined` is in both:
1. `app/navigation/StackNavigator.tsx` (RootStackParamList type)
2. `app/navigation/types.ts` (RootStackParamList type)

### Issue: Functions not found
**Solution**: Re-run migration:
```sql
-- In Supabase SQL Editor
-- Run: supabase/migrations/20251217_add_content_moderation.sql
```

## 📝 Future Enhancements

Potential features to add:
1. **Bulk Actions**: Approve/reject multiple songs at once
2. **Filtering**: Filter by submission date, user, status
3. **Search**: Search pending songs by name or artist
4. **Notes**: Add admin notes to rejected songs
5. **Notifications**: Notify users when their songs are approved/rejected
6. **Analytics**: Track moderation metrics (response time, approval rate)
7. **Audit Log**: Record all moderation actions for compliance
8. **Auto-moderation**: AI-powered content filtering

## 🔗 Related Files

- Frontend: [ContentModerationScreen.tsx](app/screens/ContentModerationScreen/ContentModerationScreen.tsx)
- Navigation: [StackNavigator.tsx](app/navigation/StackNavigator.tsx)
- Migration: [20251217_add_content_moderation.sql](supabase/migrations/20251217_add_content_moderation.sql)
- Admin Utils: [adminUtils.ts](app/util/adminUtils.ts)
- Types: [types.ts](app/navigation/types.ts)

## ⚠️ Important Notes

1. **Existing RLS Not Modified**: This migration only adds new policies, never drops or modifies existing ones
2. **Idempotent Design**: Safe to run migration multiple times
3. **Admin Check Required**: Every function and policy verifies admin status
4. **SECURITY DEFINER**: Functions run with elevated privileges but have built-in security checks
5. **Audit Trail**: Consider adding logging for moderation actions in production
6. **Backup First**: Always backup database before running migrations in production

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all files are correctly placed
3. Ensure migration ran successfully
4. Check Supabase logs for errors
5. Verify admin user setup in `admins` table
