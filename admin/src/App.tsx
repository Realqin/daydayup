import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Layout, Menu } from "antd";
import Categories from "./pages/Categories";
import Knowledge from "./pages/Knowledge";
import "./App.css";

const { Header, Content, Sider } = Layout;

function App() {
  return (
    <BrowserRouter>
      <Layout style={{ minHeight: "100vh" }}>
        <Header style={{ color: "#fff", fontSize: 18, display: "flex", alignItems: "center" }}>
          拾刻 · 后台管理
        </Header>
        <Layout>
          <Sider width={200}>
            <Menu
              mode="inline"
              style={{ height: "100%", paddingTop: 16 }}
              items={[
                { key: "categories", label: <NavLink to="/">知识分类</NavLink> },
                { key: "knowledge", label: <NavLink to="/knowledge">知识点</NavLink> },
              ]}
            />
          </Sider>
          <Content style={{ background: "#f0f2f5", minHeight: "calc(100vh - 64px)" }}>
            <Routes>
              <Route path="/" element={<Categories />} />
              <Route path="/knowledge" element={<Knowledge />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
