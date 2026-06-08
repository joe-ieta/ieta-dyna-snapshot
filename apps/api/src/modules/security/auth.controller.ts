import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { IsString } from "class-validator";
import { Request } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { UserEntity } from "../../database/entities/user.entity";
import { AuthService } from "./auth.service";

class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Get("me")
  me(@Req() request: Request & { user: UserEntity }) {
    return this.auth.toDto(request.user);
  }
}
