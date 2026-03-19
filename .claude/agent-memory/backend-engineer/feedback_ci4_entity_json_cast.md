---
name: CI4 Entity JSON Cast Behavior
description: CI4 Entity json cast expects a native PHP array/object on set, not a pre-encoded JSON string
type: feedback
---

When testing or using CI4 Entity json cast fields, pass a native PHP array or object — not a pre-encoded JSON string:

```php
// Correct:
$user->fill(['settings' => ['emailComment' => true]]);

// Wrong (causes double-encoding, reading back returns a string instead of object):
$user->fill(['settings' => json_encode(['emailComment' => true])]);
```

**Why:** CI4's `JsonCast::set()` runs `json_encode()` on whatever is stored. If you pass in an already-encoded JSON string, it gets double-encoded. Reading back via `JsonCast::get()` decodes only one layer, returning the original JSON string instead of the expected stdClass.

**How to apply:** Whenever writing entity tests or hydrating entity json fields in application code, always pass native PHP arrays/objects, not JSON strings.
