import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/category/$categoryId')({
  component: CategoryRoute,
})

function CategoryRoute() {
  const { categoryId } = Route.useParams()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Category Placeholder: {categoryId}</h1>
      <p>This will display the filtered roster for the selected category.</p>
    </div>
  )
}
