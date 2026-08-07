import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { checkIpRateLimit } from './ipRateLimit'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        // Throttle by IP so the login form cannot be used for password guessing.
        const forwarded = req?.headers?.['x-forwarded-for']
        const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() ?? 'unknown'
        const throttle = checkIpRateLimit(`login:${ip}`, 20, 15 * 60 * 1000)
        if (!throttle.allowed) {
          throw new Error('Too many sign-in attempts. Please try again later.')
        }

        // Signup stores emails lowercased, but accounts created before that
        // change may be mixed case, so fall back to the address as typed.
        const normalizedEmail = credentials.email.trim().toLowerCase()
        const user =
          (await prisma.user.findUnique({ where: { email: normalizedEmail } })) ??
          (await prisma.user.findUnique({ where: { email: credentials.email } }))

        if (!user || !user.password) {
          throw new Error('Invalid credentials')
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isCorrectPassword) {
          throw new Error('Invalid credentials')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id as string
        (session.user as any).role = token.role
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development'
}
