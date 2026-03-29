// Trusted Types policy for YouTube and other sites with CSP: require-trusted-types-for 'script'
// This MUST run before any innerHTML/outerHTML/insertAdjacentHTML assignments.
// The 'default' policy automatically wraps all raw string assignments globally,
// covering both our code AND @require'd libraries (Turndown.js, Readability.js).
if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
    try {
        // Create a default policy — auto-wraps ALL innerHTML assignments
        if (!trustedTypes.defaultPolicy) {
            trustedTypes.createPolicy('default', {
                createHTML: (string) => string,
                createScript: (string) => string,
                createScriptURL: (string) => string
            });
        }
    } catch (e) {
        // Default policy already exists (another script created one); try a named policy
        try {
            window.__nacTrustedTypesPolicy = trustedTypes.createPolicy('nac-policy', {
                createHTML: (string) => string,
                createScript: (string) => string,
                createScriptURL: (string) => string
            });
        } catch (e2) {
            console.warn('[NAC] Could not create Trusted Types policy:', e2.message);
        }
    }
}
