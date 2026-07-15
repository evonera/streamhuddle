import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/sign-up')({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/sign-in',
      search: {
        ...search,
        mode: 'signup',
      },
    })
  },
})
