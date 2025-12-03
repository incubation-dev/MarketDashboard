import { createSchema } from 'graphql-yoga'
import { z } from 'zod'
import {
  deleteMarketData,
  getMarketDataById,
  listMarketData,
  upsertMarketData
} from '../db/marketData'
import type { GraphQLContext, MarketDataFilter, MarketDataInput } from '../types'

const filterSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  segment: z.string().min(1).optional(),
  issueContains: z.string().min(1).optional(),
  year: z.coerce.number().int().optional(),
  notionPageId: z.string().min(1).optional()
})

const subpageInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  path: z.string().optional().nullable(),
  markdown: z.string().min(1)
})

const inputSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  segment: z.string().min(1),
  issue: z.string().optional().nullable(),
  year: z.coerce.number().int(),
  marketSize: z.number().optional().nullable(),
  growthRate: z.number().optional().nullable(),
  top10Ratio: z.number().optional().nullable(),
  players: z.array(z.string()).optional().nullable(),
  links: z.array(z.string()).optional().nullable(),
  summary: z.string().optional().nullable(),
  notionPageId: z.string().optional().nullable(),
  notionParentId: z.string().optional().nullable(),
  subpagePath: z.string().optional().nullable(),
  subpages: z.array(subpageInputSchema).optional().nullable(),
  lastSyncedAt: z.string().optional().nullable()
})

const typeDefs = /* GraphQL */ `
  type MarketDataSubpage {
    id: ID!
    title: String!
    path: String
    markdown: String!
  }

  type MarketData {
    id: ID!
    segment: String!
    issue: String
    year: Int!
    marketSize: Float
    growthRate: Float
    top10Ratio: Float
    players: [String!]!
    links: [String!]!
    summary: String
    notionPageId: String
    notionParentId: String
    subpagePath: String
    subpages: [MarketDataSubpage!]!
    lastSyncedAt: String
    createdAt: String
    updatedAt: String
  }

  input MarketDataFilterInput {
    id: ID
    segment: String
    issueContains: String
    year: Int
    notionPageId: String
  }

  input MarketDataSubpageInput {
    id: ID!
    title: String!
    path: String
    markdown: String!
  }

  input MarketDataInput {
    id: ID
    segment: String!
    issue: String
    year: Int!
    marketSize: Float
    growthRate: Float
    top10Ratio: Float
    players: [String!]
    links: [String!]
    summary: String
    notionPageId: String
    notionParentId: String
    subpagePath: String
    subpages: [MarketDataSubpageInput!]
    lastSyncedAt: String
  }

  type Query {
    marketData(filter: MarketDataFilterInput): [MarketData!]!
    marketDataById(id: ID!): MarketData
  }

  type Mutation {
    upsertMarketData(input: MarketDataInput!): MarketData!
    deleteMarketData(id: ID!): Boolean!
  }
`

export const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    Query: {
      marketData: async (_parent, args: { filter?: MarketDataFilter }, ctx: GraphQLContext) => {
        const parsedFilter = args.filter ? filterSchema.parse(args.filter) : undefined
        return listMarketData(ctx.db, parsedFilter)
      },
      marketDataById: async (_parent, args: { id: string }, ctx: GraphQLContext) => {
        const idValue = Number(args.id)
        if (Number.isNaN(idValue)) {
          throw new Error('ID must be a numeric value')
        }
        return getMarketDataById(ctx.db, idValue)
      }
    },
    Mutation: {
      upsertMarketData: async (_parent, args: { input: MarketDataInput }, ctx: GraphQLContext) => {
        const payload = inputSchema.parse(args.input)
        return upsertMarketData(ctx.db, payload)
      },
      deleteMarketData: async (_parent, args: { id: string }, ctx: GraphQLContext) => {
        const idValue = Number(args.id)
        if (Number.isNaN(idValue)) {
          throw new Error('ID must be a numeric value')
        }
        return deleteMarketData(ctx.db, idValue)
      }
    }
  }
})
