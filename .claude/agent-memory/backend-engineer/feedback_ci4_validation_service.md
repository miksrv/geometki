---
name: CI4 Validation Service Singleton Isolation
description: In PHPUnit tests, always request a fresh CI4 validation instance to avoid state leaking between tests
type: feedback
---

Always pass `false` as the second argument to `\Config\Services::validation()` in unit tests:

```php
$validation = \Config\Services::validation(null, false);
```

**Why:** CI4 Services returns a shared singleton by default. When multiple tests call `setRules()` on the same instance, rules and errors accumulate across tests causing false failures. Tests that pass individually fail when run together because prior test rules remain active.

**How to apply:** Any time you write PHPUnit tests that use `\Config\Services::validation()`, always use `getShared=false` (second arg). This applies to all validation-related unit tests in this project.
