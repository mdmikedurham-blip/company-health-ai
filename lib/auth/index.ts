export {
  assertCompanyAccess,
  isAuthPath,
  isProtectedPath,
  pickPrimaryCompanyId,
  resolveAuthRedirect,
  PROTECTED_PATH_PREFIXES,
} from "./route-guards";
export {
  AuthError,
  createCompanyWorkspace,
  ensureProfileForUser,
  getSessionContext,
  getSessionUser,
  listMembershipsForUser,
  requireCompanyMembership,
  requirePrimaryCompany,
  requireSessionContext,
  requireUser,
  authErrorResponse,
} from "./session";
