import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Switch, InputNumber, message } from "antd";
import type { Category } from "../api/client";
import { api } from "../api/client";

export default function Categories() {
  const [list, setList] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Category[]>("/categories");
      setList(data);
    } catch (e) {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, values);
        message.success("更新成功");
      } else {
        await api.post("/categories", values);
        message.success("创建成功");
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } catch (e) {
      message.error("操作失败");
    }
  };

  const handleEdit = (row: Category) => {
    setEditing(row);
    form.setFieldsValue(row);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/categories/${id}`);
      message.success("删除成功");
      load();
    } catch (e) {
      message.error("删除失败");
    }
  };

  return (
    <div style={{ padding: 24, background: "#fff", minHeight: "100%" }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <h2>知识分类</h2>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          新增分类
        </Button>
      </div>
      <Table
        loading={loading}
        dataSource={list}
        rowKey="id"
        columns={[
          { title: "图标", dataIndex: "icon", width: 80, render: (v) => <span style={{ fontSize: 24 }}>{v}</span> },
          { title: "名称", dataIndex: "name" },
          { title: "免费", dataIndex: "is_free", render: (v) => (v ? "是" : "否") },
          { title: "价格(分)", dataIndex: "price", width: 90, render: (v) => (v != null ? `${v / 100}元` : "-") },
          { title: "排序", dataIndex: "sort_order", width: 80 },
          {
            title: "操作",
            width: 160,
            render: (_, row) => (
              <>
                <Button type="link" size="small" onClick={() => handleEdit(row)}>编辑</Button>
                <Button type="link" size="small" danger onClick={() => handleDelete(row.id)}>删除</Button>
              </>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "编辑分类" : "新增分类"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="icon" label="图标" initialValue="📚">
            <Input placeholder="emoji 或图标名" />
          </Form.Item>
          <Form.Item name="is_free" label="免费" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Form.Item name="price" label="价格(分)" help="付费分类填写，如390表示3.9元">
            <InputNumber min={0} placeholder="留空表示免费" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
