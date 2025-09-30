import HomePage from "@/pages/Home"
import MainLayout from "@/pages/layout"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { routes } from "@/routes/route"

export default function App() {
  return (
    <BrowserRouter /* basename="/app" */>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={<route.element />} />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
