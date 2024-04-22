import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Role } from '../../role/entities/rbac.entity';

@Entity({ name: 'User_Role_Mapping' })
export class UserRoleMapping {
  @PrimaryGeneratedColumn('uuid')
  Id: string;

  @Column('uuid')
  userId: string;
 
  @Column('uuid')
  roleId: string;

  @ManyToOne(() => Role, role => role.userRoleMappings)
  @JoinColumn({ name: 'roleId' })
  role: Role;
}

