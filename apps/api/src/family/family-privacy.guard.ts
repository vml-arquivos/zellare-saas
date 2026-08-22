import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { canManageFamilyPrivacy } from "./family-privacy-access";
import type { JwtPayload } from "../auth/interfaces/jwt-payload.interface";

@Injectable()
export class FamilyPrivacyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: JwtPayload }>().user;
    return Boolean(user && canManageFamilyPrivacy(user));
  }
}
