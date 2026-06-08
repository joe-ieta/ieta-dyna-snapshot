import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../../database/entities/user.entity";
import { verifyPassword } from "./password";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.users.findOne({ where: { username } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid username or password");
    }
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, username: user.username }),
      user: this.toDto(user),
    };
  }

  toDto(user: UserEntity) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles?.map((role) => role.code) || [],
      permissions:
        user.roles?.flatMap((role) =>
          role.permissions?.map((permission) => permission.code) || [],
        ) || [],
    };
  }
}
