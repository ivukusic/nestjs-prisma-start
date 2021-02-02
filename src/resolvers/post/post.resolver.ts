import { PrismaService } from './../../services/prisma.service';
import { PaginationArgs } from '../../common/pagination/pagination.args';
import { PostIdArgs } from '../../models/args/post-id.args';
import { UserIdArgs } from '../../models/args/user-id.args';
import {
  Resolver,
  Query,
  Parent,
  Args,
  ResolveField,
  Mutation,
  Context,
} from '@nestjs/graphql';
import { Post } from '../../models/post.model';
import { PostOrder } from '../../models/inputs/post-order.input';
import { PostConnection } from 'src/models/pagination/post-connection.model';
import { findManyCursorConnection } from '@devoxa/prisma-relay-cursor-connection';
import { User } from 'src/models/user.model';
import { UserEntity } from 'src/decorators/user.decorator';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from 'src/guards/gql-auth.guard';

@Resolver((of) => Post)
@UseGuards(GqlAuthGuard)
export class PostResolver {
  constructor(private prisma: PrismaService) {}

  @ResolveField()
  async author(@Parent() parent: any) {
    const { authorId } = parent;
    return this.prisma.user.findFirst({ where: { id: authorId } });
  }

  @Query((returns) => PostConnection)
  async publishedPosts(
    @Args() { skip, after, before, first, last }: PaginationArgs,
    @Args({ name: 'query', type: () => String, nullable: true })
    query: string,
    @Args({
      name: 'orderBy',
      type: () => PostOrder,
      nullable: true,
    })
    orderBy: PostOrder
  ) {
    const a = await findManyCursorConnection(
      (args) =>
        this.prisma.post.findMany({
          include: { author: true },
          where: {
            title: { contains: query || '' },
          },
          orderBy: orderBy
            ? { [orderBy.field]: orderBy.direction }
            : { createdAt: 'asc' },
          ...args,
        }),
      () =>
        this.prisma.post.count({
          where: {
            published: true,
            title: { contains: query || '' },
          },
        }),
      { first, last, before, after }
    );
    return a;
  }

  @Query(() => [Post])
  userPosts(@UserEntity() user: User) {
    return this.prisma.user
      .findUnique({ where: { id: user.id } })
      .posts({ where: { published: true } });
  }

  @Query(() => Post)
  async post(@Args() id: PostIdArgs) {
    return this.prisma.post.findUnique({ where: { id: id.postId } });
  }

  @Mutation(() => Post)
  async createPost(
    @Args('title') title: string,
    @Args('content', { nullable: true }) content: string,
    @UserEntity() user: User
  ): Promise<any> {
    const post = await this.prisma.post.create({
      data: {
        title: title,
        content: content,
        published: true,
        author: { connect: { id: user.id } },
      },
    });
    return post;
  }
}
