// Unit/component tests do not run Next's client/server boundary compiler.
// Own this empty test marker instead of importing Next's private dist layout.
// Production imports still use Next's real server-only boundary.
export {};
